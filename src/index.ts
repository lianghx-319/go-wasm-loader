import { join, resolve } from 'path';
import { getOptions, interpolateName, OptionObject } from 'loader-utils';
import * as webpack from 'webpack';
import { readFileSync, unlinkSync } from 'fs'
import { spawn, execFile } from 'child_process'
// import validateOptions from 'schema-utils'

export interface loaderOptions {
  root: string, // default process.env.GOROOT
  bridge: string, // file path of goBridge
  wasmExecPath: string, // wasm_exec.js path
  name?: string,
  outputPath?: string | ((url: string, resourcePath: string, context: string | boolean) => string),
}

export default function (this: webpack.loader.LoaderContext, content: string) {
  const callback = this.async() as webpack.loader.loaderCallback;

  (async function (ctx) {
    const [
      goPath,
      {
        root,
        wasmExecPath,
        bridge,
        context = ctx.rootContext,
        // outputPath,
        name = "[contenthash].[ext]"
      }
    ] = await Promise.all([getGoEnv('GOPATH'), getLoaderOptions(ctx)])
    const outFile = `${ctx.resourcePath}.wasm`;
    const goBin = join(root, 'bin/go');
    const args = ["build", "-o", outFile, ctx.resourcePath];
    const processOpts = {
      env: {
        GOPATH: goPath,
        GOROOT: root,
        GOCACHE: join(__dirname, "./.gocache"),
        GOOS: "js",
        GOARCH: "wasm"
      }
    };

    const immutable = /\[([^:\]]+:)?(hash|contenthash)(:[^\]]+)?\]/gi.test(name);

    const url = interpolateName(ctx, name, {
      context,
      content,
    });

    try {
      await compileWasm(goBin, args, processOpts)
    } catch (error) {
      console.trace(error);
      throw error;
    }
    const out = readFileSync(outFile);
    unlinkSync(outFile);
    
    // const emittedFilename = basename(ctx.resourcePath, ".go") + ".wasm";
    const emittedFilename = url.replace(/\.go$/, '.wasm');
    const publicPath = `__webpack_public_path__ + ${JSON.stringify(emittedFilename)}`;
    // @ts-ignore
    ctx.emitFile(emittedFilename, out, null, { immutable });

    callback(
      null,
      [
        "require('!",
        wasmExecPath,
        "');",
        "import gobridge from '",
        bridge,
        "';",
        proxyBuilder(publicPath)
      ].join("")
    );
  })(this)
}

async function getLoaderOptions(context: webpack.loader.LoaderContext): Promise<loaderOptions & OptionObject> {
  const options = getOptions(context);
  const goRoot = await getGoEnv('GOROOT');

  return {
    root: goRoot,
    wasmExecPath: resolve(goRoot, 'misc/wasm/wasm_exec.js'),
    bridge: join(__dirname, "..", "dist", "gobridge.js"),
    ...options,
  }
}

function getGoEnv(name: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const ls = spawn('go', ['env', name]);
    ls.stdout.on('data', (buf: Buffer) => {
      const [ret] = buf.toString().split('\n')
      resolve(ret);
    })

    ls.stderr.on('data', (data) => {
      reject(new Error(`Child Process getGoRoot error: ${data}`));
    });
  })
}

function compileWasm(bin: string, args: string[], options: any): Promise<any> {
  return new Promise((resolve, reject) => {
    execFile(bin, args, options, (error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  })
}

const proxyBuilder = (filename: string) => `export default gobridge(fetch(${filename}).then(response => response.arrayBuffer()));`;
