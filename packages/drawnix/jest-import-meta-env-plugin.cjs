module.exports = function transformImportMetaEnvForJest({ types: t }) {
  return {
    name: 'transform-import-meta-env-for-jest',
    visitor: {
      MemberExpression(path) {
        const { node } = path;
        if (
          node.property?.name !== 'env' ||
          !node.object ||
          node.object.type !== 'MetaProperty' ||
          node.object.meta?.name !== 'import' ||
          node.object.property?.name !== 'meta'
        ) {
          return;
        }

        path.replaceWith(
          t.memberExpression(t.identifier('process'), t.identifier('env'))
        );
      },
    },
  };
};
