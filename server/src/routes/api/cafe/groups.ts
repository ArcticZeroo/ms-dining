import Router from '@koa/router';
import { GroupStorageClient } from '../../../api/storage/clients/groups.js';
import { attachRouter, requireAdmin, requireRole } from '../../../util/koa.js';
import { jsonStringifyWithoutNull } from '../../../util/serde.js';
import {
	AddGroupMembersRequestSchema,
	CreateGroupRequestSchema,
	RenameGroupRequestSchema
} from '@msdining/common/models/group';

export const registerGroupsRoutes = (parent: Router) => {
	const router = new Router({
		prefix: '/groups'
	});

	const requireGroupIdParam = (ctx: Router.RouterContext) => {
		const groupId = ctx.params.id;
		if (!groupId) {
			ctx.throw(400, 'Missing group id');
		}

		return groupId;
	}

	// GET /api/dining/groups - Get all groups
	router.get('/',
		async ctx => {
			const groups = await GroupStorageClient.getGroups();
			ctx.body = jsonStringifyWithoutNull(groups);
		});

	// GET /api/dining/groups/candidates - Get suggested groups to create (zero context)
	router.get('/candidates',
		requireAdmin,
		async ctx => {
			const candidates = await GroupStorageClient.getGroupCandidatesZeroContext();
			ctx.body = jsonStringifyWithoutNull(candidates);
		});

	// POST /api/dining/groups - Create a new group
	router.post('/',
		requireAdmin,
		async ctx => {
			const { name, entityType, initialMembers } = CreateGroupRequestSchema.parse(ctx.request.body);

			const group = await GroupStorageClient.createGroup(
				name,
				entityType,
				initialMembers
			);

			ctx.body = jsonStringifyWithoutNull({ id: group.id });
		});

	// PATCH /api/dining/groups/:id - Rename a group
	router.patch('/:id',
		requireAdmin,
		async ctx => {
			const groupId = requireGroupIdParam(ctx);
			const { name } = RenameGroupRequestSchema.parse(ctx.request.body);
			await GroupStorageClient.renameGroup(groupId, name);
			ctx.status = 204;
		});

	// DELETE /api/dining/groups/:id - Delete a group
	router.delete('/:id',
		requireAdmin,
		async ctx => {
			const groupId = requireGroupIdParam(ctx);
			await GroupStorageClient.deleteGroup(groupId);
			ctx.status = 204;
		});

	// POST /api/dining/groups/:id/members - Add members to a group
	router.post('/:id/members',
		requireAdmin,
		async ctx => {
			const groupId = requireGroupIdParam(ctx);
			const { memberIds } = AddGroupMembersRequestSchema.parse(ctx.request.body);
			await GroupStorageClient.addToGroup(groupId, memberIds);
			ctx.status = 204;
		});

	// GET /api/dining/groups/:id/candidates - Get candidate members for a group
	router.get('/:id/candidates',
		requireAdmin,
		async ctx => {
			const groupId = requireGroupIdParam(ctx);
			const candidates = await GroupStorageClient.getCandidatesForGroup(groupId);
			ctx.body = jsonStringifyWithoutNull(candidates);
		});

	attachRouter(parent, router);
};
