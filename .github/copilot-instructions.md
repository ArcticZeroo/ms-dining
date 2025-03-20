This project is called Dining and it is a web app that allows users to view
and search for cafeteria menus at the Redmond campus of Microsoft. The app is
build using React and TypeScript on the frontend, with a Node.js backend running
Koa.

# Common

The common directory maps to the `@msdining/common` package. This package contains
shared helpers and models that are used by the frontend and backend.

# Frontend Information (Client)

## Best Practices

### Components
 
Components should be defined in the following format:

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

# Backend Information (Server)

The backend runs on prisma. Do not use the prisma client directly - there are
helper clients for each different table (e.g. DailyMenuStorageClient).