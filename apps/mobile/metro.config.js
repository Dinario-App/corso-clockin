const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');
const monorepoRootPrefix = `${monorepoRoot}${path.sep}`;
const nodeModulesMarker = `${path.sep}node_modules${path.sep}`;

const reactNativeEntry = require.resolve('react-native', { paths: [projectRoot] });
const reactNativeRoot = path.dirname(reactNativeEntry);
const reactEntry = require.resolve('react', { paths: [projectRoot] });
const reactRoot = path.dirname(reactEntry);
const joseBrowserEntry = path.join(
  path.dirname(require.resolve('jose/package.json', { paths: [projectRoot] })),
  'dist/browser/index.js',
);

function remapSingleton(filePath, packageName, canonicalRoot) {
  if (!filePath) return filePath;
  const marker = `${path.sep}node_modules${path.sep}${packageName}${path.sep}`;
  const idx = filePath.lastIndexOf(marker);
  if (idx === -1) return filePath;
  const suffix = filePath.slice(idx + marker.length);
  return path.join(canonicalRoot, suffix);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(projectRoot);

const appRoot = `${path.join(projectRoot, 'app')}${path.sep}`;
const routeTestBlock = new RegExp(
  `^${escapeRegExp(appRoot)}.*\\.(?:test|spec)\\.[cm]?[jt]sx?$`,
);
const defaultBlockList = config.resolver.blockList;
config.resolver.blockList = [
  ...(Array.isArray(defaultBlockList)
    ? defaultBlockList
    : defaultBlockList
      ? [defaultBlockList]
      : []),
  routeTestBlock,
];

// Workspace packages must be watched; Expo SDK 57 already configures monorepo
// roots — keep an explicit watch for pnpm layout certainty.
config.watchFolders = Array.from(
  new Set([...(config.watchFolders ?? []), monorepoRoot]),
);

config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules ?? {}),
  stream: require.resolve('readable-stream', { paths: [projectRoot] }),
  'react-native': reactNativeRoot,
  react: reactRoot,
};

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'react-native') {
    return { type: 'sourceFile', filePath: reactNativeEntry };
  }
  if (moduleName === 'react') {
    return { type: 'sourceFile', filePath: reactEntry };
  }

  if (moduleName === 'isows' || moduleName.startsWith('zustand')) {
    return context.resolveRequest(
      { ...context, unstable_enablePackageExports: false },
      moduleName,
      platform,
    );
  }

  if (moduleName === 'jose') {
    return { type: 'sourceFile', filePath: joseBrowserEntry };
  }

  const origin = context.originModulePath || '';
  const relativeImport =
    moduleName.startsWith('./') || moduleName.startsWith('../');
  const workspaceSource =
    origin.startsWith(monorepoRootPrefix) &&
    !origin.includes(nodeModulesMarker);
  if (
    ((workspaceSource && relativeImport) ||
      (origin.startsWith(projectRoot) && moduleName.startsWith('@/'))) &&
    moduleName.endsWith('.js')
  ) {
    try {
      return context.resolveRequest(
        context,
        moduleName.replace(/\.js$/, ''),
        platform,
      );
    } catch {
    }
  }

  const resolved = context.resolveRequest(context, moduleName, platform);
  if (resolved?.type === 'sourceFile' && typeof resolved.filePath === 'string') {
    const remapped = remapSingleton(
      remapSingleton(resolved.filePath, 'react-native', reactNativeRoot),
      'react',
      reactRoot,
    );
    if (remapped !== resolved.filePath) {
      return { ...resolved, filePath: remapped };
    }
  }
  return resolved;
};

module.exports = config;
