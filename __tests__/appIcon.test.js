const fs = require('fs');
const path = require('path');

jest.mock('react-native-vector-icons/FontAwesome5', () => {
  const ReactModule = require('react');
  const ReactNative = require('react-native');
  return {
    __esModule: true,
    default: props => ReactModule.createElement(ReactNative.Text, props),
  };
});

const { APP_ICON_NAMES } = require('../src/components/AppIcon');
const solidIcons =
  require('react-native-vector-icons/glyphmaps/FontAwesome5Free_meta.json').solid;
const root = path.resolve(__dirname, '..');

function sourceFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const itemPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      return sourceFiles(itemPath);
    }
    return /\.tsx?$/.test(entry.name) ? [itemPath] : [];
  });
}

describe('AppIcon', () => {
  it('contains only valid FontAwesome 5 Solid glyphs', () => {
    expect(new Set(APP_ICON_NAMES).size).toBe(APP_ICON_NAMES.length);
    expect(APP_ICON_NAMES.filter(name => !solidIcons.includes(name))).toEqual(
      [],
    );
  });

  it('is the only vector-icon entry point in application source', () => {
    const directImports = sourceFiles(path.join(root, 'src'))
      .filter(file => !file.endsWith(`${path.sep}AppIcon.tsx`))
      .filter(file =>
        fs.readFileSync(file, 'utf8').includes('react-native-vector-icons/'),
      )
      .map(file => path.relative(root, file));

    expect(directImports).toEqual([]);
  });

  it('registers only the FontAwesome 5 Solid font natively', () => {
    const androidConfig = fs.readFileSync(
      path.join(root, 'android/app/build.gradle'),
      'utf8',
    );
    expect(androidConfig).toContain(
      'iconFontNames: ["FontAwesome5_Solid.ttf"]',
    );

    const iosConfig = fs.readFileSync(
      path.join(root, 'ios/YaaqbaIPTVScreen/Info.plist'),
      'utf8',
    );
    const fontSection = iosConfig.match(
      /<key>UIAppFonts<\/key>\s*<array>([\s\S]*?)<\/array>/,
    );
    const registeredFonts = Array.from(
      fontSection?.[1].matchAll(/<string>([^<]+\.ttf)<\/string>/g) ?? [],
      match => match[1],
    );

    expect(registeredFonts).toEqual(['FontAwesome5_Solid.ttf']);
  });
});
