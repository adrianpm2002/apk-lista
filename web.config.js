module.exports = {
  resolver: {
    alias: {
      'react-native': 'react-native-web',
    },
  },
  transformer: {
    babelTransformerPath: require.resolve('react-native-web/lib/babelTransformerFileExtension'),
  },
};
