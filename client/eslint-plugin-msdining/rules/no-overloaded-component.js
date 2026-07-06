const DEFAULT_MAX_JSX_ELEMENTS = 20;
const FUNCTION_NODE_TYPES = new Set([
    'FunctionDeclaration',
    'FunctionExpression',
    'ArrowFunctionExpression',
]);
const FC_TYPE_NAMES = new Set(['FC', 'FunctionComponent']);

const isPascalCase = (name) => typeof name === 'string' && /^[A-Z]/.test(name);

const eachChild = (node, fn) => {
    for (const key of Object.keys(node)) {
        if (key === 'parent') {
            continue;
        }

        const value = node[key];
        if (Array.isArray(value)) {
            for (const child of value) {
                if (child && typeof child.type === 'string') {
                    fn(child);
                }
            }
        } else if (value && typeof value.type === 'string') {
            fn(value);
        }
    }
};

const containsJsx = (node) => {
    let found = false;

    const visit = (current) => {
        if (found || current == null || typeof current.type !== 'string') {
            return;
        }

        if (current.type === 'JSXElement' || current.type === 'JSXFragment') {
            found = true;
            return;
        }

        eachChild(current, visit);
    };

    visit(node);
    return found;
};

const isFcAnnotated = (declaratorId) => {
    const typeAnnotation = declaratorId && declaratorId.typeAnnotation;
    if (!typeAnnotation || typeAnnotation.type !== 'TSTypeAnnotation') {
        return false;
    }

    const typeNode = typeAnnotation.typeAnnotation;
    if (!typeNode || typeNode.type !== 'TSTypeReference') {
        return false;
    }

    const typeName = typeNode.typeName;
    if (typeName.type === 'Identifier') {
        return FC_TYPE_NAMES.has(typeName.name);
    }

    if (typeName.type === 'TSQualifiedName' && typeName.right.type === 'Identifier') {
        return FC_TYPE_NAMES.has(typeName.right.name);
    }

    return false;
};

/**
 * Scores a component's render complexity. The goal is to flag components that are "doing too many
 * things" — dense conditional branching and raw markup — while NOT penalizing clean, flat composition
 * of child components (e.g. a settings panel that just lists many <SettingInput/> children).
 *
 * Scoring, per JSX element the component renders directly (not inside a nested component/map callback):
 *   - a host element (<div>, <span>, a fragment, ...): always +1 — raw markup is what we want extracted.
 *   - a component element (<Foo/>): +1 only when conditionally rendered (inside `cond && <Foo/>` or a
 *     ternary branch). An unconditional child component is composition, not complexity, so it scores 0.
 */
const scoreRenderComplexity = (fnNode) => {
    let score = 0;
    let host = 0;
    let total = 0;

    const isHostElement = (node) => {
        if (node.type === 'JSXFragment') {
            return true;
        }

        const nameNode = node.openingElement && node.openingElement.name;
        return nameNode && nameNode.type === 'JSXIdentifier' && /^[a-z]/.test(nameNode.name);
    };

    // `inConditional` is true when the current node sits inside a logical/ternary expression branch
    // (i.e. it is conditionally rendered) and we have not yet crossed a JSX element boundary.
    const visit = (node, inConditional) => {
        if (node == null || typeof node.type !== 'string') {
            return;
        }

        // Don't descend into nested functions (map callbacks, render props) — those are scored on their own.
        if (node !== fnNode && FUNCTION_NODE_TYPES.has(node.type)) {
            return;
        }

        if (node.type === 'JSXElement' || node.type === 'JSXFragment') {
            total++;

            if (isHostElement(node)) {
                host++;
                score++;
            } else if (inConditional) {
                score++;
            }

            // Children of a rendered element are composition; reset the conditional flag for them.
            eachChild(node, (child) => visit(child, false));
            return;
        }

        if (node.type === 'LogicalExpression' || node.type === 'ConditionalExpression') {
            eachChild(node, (child) => visit(child, true));
            return;
        }

        eachChild(node, (child) => visit(child, inConditional));
    };

    visit(fnNode.body, false);
    return { score, host, total };
};

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
    meta: {
        type: 'suggestion',
        docs: {
            description:
                'Warn when a single component renders a large JSX tree, a signal it is doing too many things '
                + 'and should be decomposed into smaller sub-components.',
        },
        messages: {
            overloaded:
                'Component \'{{name}}\' has a render complexity of {{score}} (max {{max}}): '
                + '{{host}} raw host elements plus conditionally-rendered branches. '
                + 'This component may be doing too many things — extract cohesive sections into their own components.',
        },
        schema: [
            {
                type:                 'object',
                additionalProperties: false,
                properties:           {
                    maxJsxElements: { type: 'integer', minimum: 1 },
                },
            },
        ],
    },
    create(context) {
        const options = context.options[0] || {};
        const maxJsxElements = options.maxJsxElements || DEFAULT_MAX_JSX_ELEMENTS;

        const check = (fnNode, nameNode, declaratorId) => {
            const name = nameNode && nameNode.name;
            if (!isPascalCase(name)) {
                return;
            }

            if (!containsJsx(fnNode) && !isFcAnnotated(declaratorId)) {
                return;
            }

            const { score, host, total } = scoreRenderComplexity(fnNode);
            if (score > maxJsxElements) {
                context.report({
                    node:      nameNode,
                    messageId: 'overloaded',
                    data:      { name, score, host, total, max: maxJsxElements },
                });
            }
        };

        return {
            VariableDeclarator(node) {
                if (node.id.type !== 'Identifier' || !node.init) {
                    return;
                }

                if (FUNCTION_NODE_TYPES.has(node.init.type)) {
                    check(node.init, node.id, node.id);
                }
            },
            FunctionDeclaration(node) {
                if (node.id) {
                    check(node, node.id, null);
                }
            },
        };
    },
};
