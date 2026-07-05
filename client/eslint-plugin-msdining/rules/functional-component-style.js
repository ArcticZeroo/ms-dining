const FC_TYPE_NAMES = new Set(['FC', 'FunctionComponent']);
const JSX_NODE_TYPES = new Set(['JSXElement', 'JSXFragment']);

const isPascalCase = (name) => typeof name === 'string' && /^[A-Z]/.test(name);

/**
 * Recursively determines whether a subtree contains any JSX, which we use as a
 * heuristic for "this PascalCase function is a React component".
 */
const containsJsx = (node) => {
    if (node == null || typeof node.type !== 'string') {
        return false;
    }

    if (JSX_NODE_TYPES.has(node.type)) {
        return true;
    }

    for (const key of Object.keys(node)) {
        if (key === 'parent') {
            continue;
        }

        const value = node[key];

        if (Array.isArray(value)) {
            for (const child of value) {
                if (child && typeof child.type === 'string' && containsJsx(child)) {
                    return true;
                }
            }
        } else if (value && typeof value.type === 'string' && containsJsx(value)) {
            return true;
        }
    }

    return false;
};

const getSimpleTypeName = (typeName) => {
    if (!typeName) {
        return undefined;
    }

    if (typeName.type === 'Identifier') {
        return typeName.name;
    }

    // e.g. React.FC -> right-hand Identifier "FC"
    if (typeName.type === 'TSQualifiedName' && typeName.right.type === 'Identifier') {
        return typeName.right.name;
    }

    return undefined;
};

/**
 * If the given type annotation is a React.FC / FC / React.FunctionComponent reference,
 * return details about its generic type argument; otherwise undefined.
 */
const getFcTypeInfo = (typeAnnotationNode) => {
    if (!typeAnnotationNode || typeAnnotationNode.type !== 'TSTypeAnnotation') {
        return undefined;
    }

    const typeNode = typeAnnotationNode.typeAnnotation;
    if (!typeNode || typeNode.type !== 'TSTypeReference') {
        return undefined;
    }

    const simpleName = getSimpleTypeName(typeNode.typeName);
    if (!simpleName || !FC_TYPE_NAMES.has(simpleName)) {
        return undefined;
    }

    // @typescript-eslint/parser v6 exposes generics as `typeParameters`; newer versions use `typeArguments`.
    const typeArgs = typeNode.typeArguments || typeNode.typeParameters;
    const argList = (typeArgs && typeArgs.params) || [];
    const firstArg = argList[0];

    return {
        hasTypeArg:      firstArg != null,
        isInlineLiteral: firstArg != null && firstArg.type === 'TSTypeLiteral',
        literalNode:     firstArg,
    };
};

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
    meta: {
        type: 'suggestion',
        docs: {
            description:
                'Require functional components to be arrow consts, typed as React.FC<INameProps> with a named '
                + 'props interface whenever they accept props.',
        },
        messages: {
            useArrowComponent:
                'Define component \'{{name}}\' as an arrow const '
                + '(e.g. `const {{name}}: React.FC<...> = () => ...`), not a function declaration/expression.',
            requireFcWithProps:
                'Component \'{{name}}\' accepts props, so it must be typed as '
                + '`const {{name}}: React.FC<I{{name}}Props>`. Move the prop types into a named interface.',
            requireNamedPropsInterface:
                'Component \'{{name}}\' must use a named props interface (e.g. `I{{name}}Props`) '
                + 'as the React.FC type argument, not an inline object type.',
            requireFcTypeArg:
                'Component \'{{name}}\' accepts props but React.FC is missing its type argument; '
                + 'specify `React.FC<I{{name}}Props>`.',
        },
        schema: [],
    },
    create(context) {
        const checkComponent = (fnNode, nameNode, declaratorId, isFunctionKeyword) => {
            const name = nameNode && nameNode.name;

            if (!isPascalCase(name)) {
                return;
            }

            const fcInfo = declaratorId ? getFcTypeInfo(declaratorId.typeAnnotation) : undefined;

            // A definition is a component if it renders JSX, or is explicitly typed as React.FC
            // (the latter catches components that only ever return null, e.g. imperative map effects).
            if (fcInfo == null && !containsJsx(fnNode)) {
                return;
            }

            if (isFunctionKeyword) {
                context.report({ node: nameNode, messageId: 'useArrowComponent', data: { name } });
                return;
            }

            const hasProps = fnNode.params.length > 0;
            if (!hasProps) {
                return;
            }

            if (!fcInfo) {
                context.report({ node: declaratorId || fnNode, messageId: 'requireFcWithProps', data: { name } });
                return;
            }

            if (fcInfo.isInlineLiteral) {
                context.report({ node: fcInfo.literalNode, messageId: 'requireNamedPropsInterface', data: { name } });
            } else if (!fcInfo.hasTypeArg) {
                context.report({ node: declaratorId, messageId: 'requireFcTypeArg', data: { name } });
            }
        };

        return {
            VariableDeclarator(node) {
                if (node.id.type !== 'Identifier' || !node.init) {
                    return;
                }

                if (node.init.type === 'ArrowFunctionExpression') {
                    checkComponent(node.init, node.id, node.id, false);
                } else if (node.init.type === 'FunctionExpression') {
                    checkComponent(node.init, node.id, node.id, true);
                }
            },
            FunctionDeclaration(node) {
                if (!node.id) {
                    return;
                }

                checkComponent(node, node.id, null, true);
            },
        };
    },
};
