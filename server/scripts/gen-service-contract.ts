import { access, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

type RuntimeDataServices = Record<string, Record<string, unknown>>;

type ServiceSourceInfo = {
    serviceName: string;
    interfaceName: string;
    interfaceImportPath: string;
    methodNames: string[];
};

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const SERVER_ROOT = path.resolve(SCRIPT_DIR, '..');
const SRC_ROOT = path.join(SERVER_ROOT, 'src');
const SOURCE_DATA_SERVICES_PATH = path.join(SRC_ROOT, 'worker', 'data', 'data-services.ts');
const DIST_DATA_SERVICES_PATH = path.join(SERVER_ROOT, 'dist', 'worker', 'data', 'data-services.js');
const OUTPUT_PATH = path.join(SRC_ROOT, 'shared', 'services', 'data-service-contract.generated.ts');
const OUTPUT_DIR = path.dirname(OUTPUT_PATH);

const toTypeScriptSourcePath = (importerPath: string, specifier: string): string => {
    const resolvedPath = path.resolve(path.dirname(importerPath), specifier);
    return resolvedPath.replace(/\.js$/, '.ts');
};

const toGeneratedImportPath = (targetPath: string): string => {
    const relativePath = path.relative(OUTPUT_DIR, targetPath)
        .replace(/\\/g, '/')
        .replace(/\.ts$/, '.js');

    return relativePath.startsWith('.') ? relativePath : `./${relativePath}`;
};

const getSourceImportMap = (source: string): Map<string, string> => {
    const importMap = new Map<string, string>();
    const importPattern = /import\s*\{([^}]+)\}\s*from\s*'([^']+)';/g;

    for (const match of source.matchAll(importPattern)) {
        const [, importedNames, specifier] = match;
        if (importedNames == null || specifier == null) {
            continue;
        }

        for (const importedName of importedNames.split(',')) {
            const localName = importedName.trim();
            if (localName.length > 0) {
                importMap.set(localName, specifier);
            }
        }
    }

    return importMap;
};

const getServiceImportNames = (source: string): Array<{ serviceName: string; importName: string }> => {
    const match = source.match(/export const DATA_SERVICES = \{([\s\S]*?)\}\s*(?:as const|satisfies)/);
    if (match?.[1] == null) {
        throw new Error(`Could not find DATA_SERVICES object in ${SOURCE_DATA_SERVICES_PATH}`);
    }

    const services: Array<{ serviceName: string; importName: string }> = [];
    const entryPattern = /(\w+)\s*:\s*(\w+)\s*,/g;

    for (const entry of match[1].matchAll(entryPattern)) {
        const [, serviceName, importName] = entry;
        if (serviceName == null || importName == null) {
            continue;
        }

        services.push({ serviceName, importName });
    }

    return services;
};

const getInterfaceInfo = async (commandFilePath: string) => {
    const source = await readFile(commandFilePath, 'utf8');
    const interfaceMatch = source.match(/satisfies\s+(I\w+Service)\s*;/);
    if (interfaceMatch?.[1] == null) {
        throw new Error(`Could not find service interface in ${commandFilePath}`);
    }

    const interfaceName = interfaceMatch[1];
    const interfaceImportPattern = new RegExp(`import\\s+(?:type\\s+)?\\{[^}]*\\b${interfaceName}\\b[^}]*\\}\\s+from\\s+'([^']+)';`);
    const interfaceImportMatch = source.match(interfaceImportPattern);
    if (interfaceImportMatch?.[1] == null) {
        throw new Error(`Could not find import for ${interfaceName} in ${commandFilePath}`);
    }

    const interfaceSourcePath = toTypeScriptSourcePath(commandFilePath, interfaceImportMatch[1]);

    return {
        interfaceName,
        interfaceImportPath: toGeneratedImportPath(interfaceSourcePath),
    };
};

const getRuntimeDataServices = async (): Promise<RuntimeDataServices> => {
    await access(DIST_DATA_SERVICES_PATH).catch(() => {
        throw new Error('Build artifacts not found. Run `npx tsc` in server/ before generating the service contract.');
    });

    const importedModule = await import(pathToFileURL(DIST_DATA_SERVICES_PATH).href) as { DATA_SERVICES?: RuntimeDataServices };
    if (importedModule.DATA_SERVICES == null) {
        throw new Error(`DATA_SERVICES was not exported by ${DIST_DATA_SERVICES_PATH}`);
    }

    return importedModule.DATA_SERVICES;
};

const generateFileText = (services: ServiceSourceInfo[]): string => {
    const uniqueImports = new Map<string, string>();
    for (const service of services) {
        uniqueImports.set(service.interfaceName, service.interfaceImportPath);
    }

    const importLines = [...uniqueImports.entries()].map(([interfaceName, importPath]) =>
        `import type { ${interfaceName} } from '${importPath}';`
    );

    const serviceMapLines = services.map(service =>
        `    ${service.serviceName}: ${service.interfaceName};`
    );

    const serviceKeyLines = services.map(service => {
        const methodList = service.methodNames.map(methodName => `'${methodName}'`).join(', ');
        return `    ${service.serviceName}: [${methodList}] as const,`;
    });

    return `/**\n * AUTO-GENERATED by scripts/gen-service-contract.ts\n * Do not edit manually. Run \`npm run gen:service-contract\` to regenerate.\n */\n\n${importLines.join('\n')}\n\nexport interface DataServiceMap {\n${serviceMapLines.join('\n')}\n}\n\nexport const DATA_SERVICE_KEYS = {\n${serviceKeyLines.join('\n')}\n} as const satisfies { [K in keyof DataServiceMap]: ReadonlyArray<keyof DataServiceMap[K]> };\n`;
};

const main = async () => {
    const dataServicesSource = await readFile(SOURCE_DATA_SERVICES_PATH, 'utf8');
    const importMap = getSourceImportMap(dataServicesSource);
    const serviceImports = getServiceImportNames(dataServicesSource);
    const runtimeDataServices = await getRuntimeDataServices();

    const services: ServiceSourceInfo[] = [];

    for (const { serviceName, importName } of serviceImports) {
        const importSpecifier = importMap.get(importName);
        if (importSpecifier == null) {
            throw new Error(`Could not resolve import for ${importName}`);
        }

        const runtimeService = runtimeDataServices[serviceName];
        if (runtimeService == null) {
            throw new Error(`Runtime DATA_SERVICES is missing ${serviceName}`);
        }

        const commandFilePath = toTypeScriptSourcePath(SOURCE_DATA_SERVICES_PATH, importSpecifier);
        const interfaceInfo = await getInterfaceInfo(commandFilePath);

        services.push({
            serviceName,
            interfaceName: interfaceInfo.interfaceName,
            interfaceImportPath: interfaceInfo.interfaceImportPath,
            methodNames: Object.keys(runtimeService),
        });
    }

    await writeFile(OUTPUT_PATH, generateFileText(services));
    console.log(`Generated ${path.relative(SERVER_ROOT, OUTPUT_PATH)} for ${services.length} services.`);
};

await main();
process.exit(0);
