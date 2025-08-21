import { usePrismaClient } from '../api/storage/client.js';

const ALLOWED_ROLES = new Set([
	'user',
	'admin'
]);

const id = process.argv[2];
const role = process.argv[3];

if (!id || !role) {
	console.error('Usage: node assign-role.js <userId> <role>');
	process.exit(1);
}

if (!ALLOWED_ROLES.has(role)) {
	console.error(`Invalid role: ${role}. Allowed roles are: ${Array.from(ALLOWED_ROLES).join(', ')}`);
	process.exit(1);
}

await usePrismaClient(client => client.user.update({
	where: { id },
	data: { role: role }
}));

console.log('Role updated successfully');