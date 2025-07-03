This project is called Dining and it is a web app that allows users to view
and search for cafeteria menus at the Redmond campus of Microsoft. The app is
build using React and TypeScript on the frontend, with a Node.js backend running Koa.

The project is made up of three packages:
- Common: maps to the npm `@msdining/common` package. This package contains shared helpers and models used by frontend + backend. Run `npx tsc` in the common folder each time you make changes so that the symlink is updated.
- Client: the react frontend
- Server: the Koa backend, with a Prisma database.

# Code Change Guidance

## Client

### Components

In the frontend, components should be defined in the following format:

```tsx
// Note the I in front of the interface name
interface IMyComponentProps {
  prop1: string;
  prop2: number;
}

// Always define with React.FC as the type for components with types.
const MyComponent: React.FC<IMyComponentProps> = ({ prop1, prop2 }) => {
  return (
    <div>
      <p>{prop1}</p>
      <p>{prop2}</p>
    </div>
  );
};
```

### Other

- Avoid inline styles, try to use classes where available. You can use `classNames(...args[])` to conditionally add class names (see definition in `util/react.ts`)

## Server

Using prisma: The backend runs on prisma. Do not use the prisma client directly - there are helper clients for each different table (e.g. DailyMenuStorageClient).