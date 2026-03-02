const requirePromiseStateStageName = 'require-promise-state-stage';

const HOOK_NAMES = new Set([
    'useDelayedPromiseState',
    'useImmediatePromiseState',
]);

/** @type {import('eslint').Rule.RuleModule} */
const requirePromiseStateStage = {
    meta: {
        type: 'problem',
        docs: {
            description: 'Require stage/actualStage or value+error when destructuring promise state hooks',
        },
        messages: {
            missingStageHandling:
                'Destructuring {{ hookName }} must include `stage` or `actualStage`, or both `value` and `error`. '
                + 'Without error handling, promise failures will be silently ignored.',
        },
        schema: [],
    },
    create(context) {
        return {
            VariableDeclarator(node) {
                if (node.id.type !== 'ObjectPattern' || !node.init || node.init.type !== 'CallExpression') {
                    return;
                }

                const callee = node.init.callee;
                const hookName = callee.type === 'Identifier' ? callee.name : undefined;

                if (!hookName || !HOOK_NAMES.has(hookName)) {
                    return;
                }

                const destructuredKeys = new Set();
                for (const property of node.id.properties) {
                    if (property.type === 'Property' && property.key.type === 'Identifier') {
                        destructuredKeys.add(property.key.name);
                    }
                }

                const hasStage = destructuredKeys.has('stage') || destructuredKeys.has('actualStage');
                const hasValueAndError = destructuredKeys.has('value') && destructuredKeys.has('error');

                if (!hasStage && !hasValueAndError) {
                    context.report({
                        node: node.id,
                        messageId: 'missingStageHandling',
                        data: { hookName },
                    });
                }
            },
        };
    },
};

module.exports = {
    rules: {
        [requirePromiseStateStageName]: requirePromiseStateStage,
    },
};
