const webpack = require('webpack');

module.exports = {
    mode: 'production',
    entry: './src/index.tsx',
    module: {
        rules: [{
            test: /\.tsx?$/,
            use: 'ts-loader',
            exclude: /node_modules/,
        }]
    },
    resolve: {
        extensions: ['.tsx', '.ts', '.js'],
        fallback: {
            crypto: false,
            buffer: require.resolve('buffer/'),
        },
    },
    performance: {
        hints: false,
    }
};
