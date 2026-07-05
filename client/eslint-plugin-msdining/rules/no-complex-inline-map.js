const DEFAULT_MAX_JSX_ELEMENTS = 3;
const FUNCTION_NODE_TYPES = new Set([
    'FunctionDeclaration',
    'FunctionExpression',
    'ArrowFunctionExpression',
]);

/** Count JSXElement / JSXFragment nodes contained in a subtree (inclusive of the root). */
const countJsxElements = (node) => {
    let count = 0;

    const visit = (current) => {
        if (current == null || typeof current.type !== 'string') {
            return;
        }

        if (current.type === 'JSXElement' || current.type === 'JSXFragment') {
            count++;
        }

        for (const key of Object.keys(current)) {
            if (key === 'parent') {
                continue;
            }

            const value = current[key];

            if (Array.isArray(value)) {
                for (const child of value) {
                    visit(child);
                }
            } else if (value && typeof value.type === 'string') {
                visit(value);
            }
        }
    };

    visit(node);
    return count;
};

/** A "host root" is raw markup — a lowercase element (div/span/...) or a fragment — rather than a component. */
const isHostRoot = (root) => {
    if (root.type === 'JSXFragment') {
        return true;
    }

    const nameNode = root.openingElement && root.openingElement.name;
    if (nameNode && nameNode.type === 'JSXIdentifier') {
        return /^[a-z]/.test(nameNode.name);
    }

    // JSXMemberExpression (e.g. Foo.Bar) is treated as a component, not host markup.
    return false;
};

/** Collect the JSX expression(s) a function returns, unwrapping ternaries / `cond && <jsx/>`. */
const collectReturnedJsxRoots = (fnNode) => {
    const roots = [];

    const pushFromExpression = (expr) => {
        if (expr == null) {
            return;
        }

        if (expr.type === 'JSXElement' || expr.type === 'JSXFragment') {
            roots.push(expr);
        } else if (expr.type === 'ConditionalExpression') {
            pushFromExpression(expr.consequent);
            pushFromExpression(expr.alternate);
        } else if (expr.type === 'LogicalExpression') {
            pushFromExpression(expr.right);
        }
    };

    if (fnNode.body.type !== 'BlockStatement') {
        pushFromExpression(fnNode.body);
        return roots;
    }

    const visit = (current) => {
        if (current == null || typeof current.type !== 'string') {
            return;
        }

        // Don't descend into nested functions — their returns aren't this map's item markup.
        if (current !== fnNode && FUNCTION_NODE_TYPES.has(current.type)) {
            return;
        }

        if (current.type === 'ReturnStatement') {
            pushFromExpression(current.argument);
        }

        for (const key of Object.keys(current)) {
            if (key === 'parent') {
                continue;
            }

            const value = current[key];

            if (Array.isArray(value)) {
                for (const child of value) {
                    visit(child);
                }
            } else if (value && typeof value.type === 'string') {
                visit(value);
            }
        }
    };

    visit(fnNode.body);
    return roots;
};

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
    meta: {
        type: 'suggestion',
        docs: {
            description:
                'Disallow complex inline JSX inside array .map() callbacks; extract the item into its own '
                + 'component instead of nesting rendering logic in the parent.',
        },
        messages: {
            complexInlineMap:
                'This .map() renders complex inline markup ({{count}} JSX elements, max {{max}}). '
                + 'Extract the item into its own component instead of nesting rendering logic here.',
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

        return {
            CallExpression(node) {
                const callee = node.callee;
                if (callee.type !== 'MemberExpression' || callee.computed) {
                    return;
                }

                if (callee.property.type !== 'Identifier' || callee.property.name !== 'map') {
                    return;
                }

                const callback = node.arguments[0];
                if (!callback || !FUNCTION_NODE_TYPES.has(callback.type)) {
                    return;
                }

                const roots = collectReturnedJsxRoots(callback);

                for (const root of roots) {
                    if (!isHostRoot(root)) {
                        continue;
                    }

                    const count = countJsxElements(root);
                    if (count > maxJsxElements) {
                        context.report({
                            node:      root.type === 'JSXElement' ? root.openingElement : root,
                            messageId: 'complexInlineMap',
                            data:      { count, max: maxJsxElements },
                        });
                        return;
                    }
                }
            },
        };
    },
};
