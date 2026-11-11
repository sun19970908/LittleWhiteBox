// Only dependencies whose callers already handle absence belong here.
const namespace = 'optional-runtime-dependency';
export const optionalRuntimeDependencies = {
    name: 'optional-runtime-dependency-stubs',
    setup(context) {
        context.onResolve({ filter: /^(bufferutil|utf-8-validate)$/ }, args => ({
            path: args.path,
            namespace,
        }));
        // debug catches this optional terminal-color probe; other callers must
        // still resolve their own dependencies normally.
        context.onResolve({ filter: /^supports-color$/ }, args => {
            if (/[\\/]node_modules[\\/]debug[\\/]src[\\/]node\.js$/.test(args.importer)) {
                return { path: args.path, namespace };
            }
        });
        context.onLoad({ filter: /.*/, namespace }, args => ({
            contents: `throw new Error(${JSON.stringify(`${args.path} is not bundled`)});`,
            loader: 'js',
        }));
    },
};
