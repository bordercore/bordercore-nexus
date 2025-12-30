const path = require("path");
const webpack = require("webpack");
const BundleTracker = require("webpack-bundle-tracker");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const RemoveEmptyScriptsPlugin = require("webpack-remove-empty-scripts");
const StylelintPlugin = require("stylelint-webpack-plugin");
const {VueLoaderPlugin} = require("vue-loader");

module.exports = (env, argv) => {
    const devMode = argv.mode == "development";

    const entries = {
        "dist/css/bordercore": ["./static/scss/bordercore-webpack.scss"],
        "dist/css/vue-sidebar-menu": ["./static/css/vue-sidebar-menu/vue-sidebar-menu.scss"],
    };
    // Exclude JavaScript code if the environment variable WEBPACK_CSS_ONLY is set
    if (!process.env.WEBPACK_CSS_ONLY) {
        entries["dist/js/javascript"] = ["./front-end/index.js"];
    }

    config = {
        entry: entries,
        output: {
            filename: "[name]-bundle-[contenthash].min.js",
            path: path.resolve(__dirname, "./static"),
        },
        mode: "production",
        resolve: {
            alias: {
                vue$: "vue/dist/vue.esm-bundler.js",
            },
        },
        externals: {
            "sqlite3": "commonjs sqlite3",
        },
        plugins: [
            // Lint my SCSS - temporarily disabled due to config conflicts
            // new StylelintPlugin({
            //     // By default compiler.options.output.path is included
            //     // in the exclude list, which would mean our 'static'
            //     // folder would be skipped. So set it to the empty list.
            //     exclude: [],
            //     files: "static/scss/**.scss",
            // }),

            // Remove the boilerplate JS files from chunks of CSS only entries
            new RemoveEmptyScriptsPlugin(),

            // Extract generated CSS into separate files
            new MiniCssExtractPlugin({
                filename: devMode ? "[name].css" : "[name]-[contenthash].min.css",
            }),

            // Define these to improve tree-shaking and muffle browser warnings
            new webpack.DefinePlugin({
                __VUE_OPTIONS_API__: true,
                __VUE_PROD_DEVTOOLS__: false,
            }),

            // Responsible for cloning any other rules you have defined and applying them
            //  to the corresponding language blocks in .vue files
            new VueLoaderPlugin(),

            // Create source maps for minified .js and .css files
            new webpack.SourceMapDevToolPlugin({
                filename: "[file].map",
                test: new RegExp("\.[js|css].*"),
            }),

            // Generate stats about the webpack compilation process to a file, which
            //  will be later read by Django
            new BundleTracker({
                filename: "./webpack-stats.json",
                publicPath: "https://www.bordercore.com/static/",
            }),
        ],
        module: {
            rules: [
                {
                    test: /\.scss$/i,
                    use: [
                        MiniCssExtractPlugin.loader,
                        // Translates CSS into CommonJS
                        "css-loader",
                        // Compiles Sass to CSS
                        "sass-loader",
                    ],
                },
                // this will apply to both plain `.css` files
                // AND `<style>` blocks in `.vue` files,
                {
                    test: /\.css$/,
                    use: [
                        "style-loader",
                        {
                            loader: "css-loader",
                            options: {
                                esModule: false,
                            },
                        },
                    ],
                },
                {
                    test: /\.vue$/,
                    loader: "vue-loader",
                },
                {
                    test: /\.(js|jsx)$/,
                    use: "babel-loader",
                    exclude: /node_modules/, // Avoid transpiling node_modules
                },
                {
                    test: /\.(jpg|jpeg|png|woff|woff2|eot|ttf|svg)$/,
                    loader: "url-loader",
                },
            ],
        },
    };

    if (devMode) {
        config.output.filename = "[name]-bundle.js";
    } else {
        config.devtool = "source-map";
        config.output.clean = {
            keep: /^(admin|css|fonts|html|img|public|rest_framework|scss|dist\/css\/bordercore.css|dist\/css\/bordercore.css.map|dist\/js\/javascript-bundle.js|dist\/js\/javascript-bundle.js.map)/,
        };
    }

    if (process.env.ANALYZER) {
        const BundleAnalyzerPlugin = require("webpack-bundle-analyzer").BundleAnalyzerPlugin;
        config.plugins.push(new BundleAnalyzerPlugin({analyzerPort: 9999}));
    }

    return config;
};
