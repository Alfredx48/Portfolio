import { defineConfig } from 'vite';
import solidPlugin from 'vite-plugin-solid';
// import devtools from 'solid-devtools/vite';

export default defineConfig({
	plugins: [
		/* 
    Uncomment the following line to enable solid-devtools.
    For more info see https://github.com/thetarnav/solid-devtools/tree/main/packages/extension#readme
    */
		// devtools({
		//   autoname: true,
		// }),
		solidPlugin(),
	],
	server: {
		port: 3000,
	},
	build: {
		target: 'esnext',
	},
	test: {
		environment: 'jsdom',
		globals: true,
		testTransformMode: { web: ['/.[jt]sx?$/'] },
		includeSource: ['src/**/*.js', 'src/**/*.jsx'],
		deps: {
			optimizer: {
				web: {
					include: ['src/**/*.js', 'src/**/*.jsx'],
				},
			},
		},
	},
});
