import routes from '../../config/routes';

type AppRoute = {
  name?: string;
  path?: string;
  redirect?: string;
  routes?: AppRoute[];
};

describe('administration route hierarchy', () => {
  it('groups AI governance pages under one menu branch', () => {
    const administration = (routes as AppRoute[]).find(
      (route) => route.path === '/administration',
    );
    const administrationRoutes = administration?.routes ?? [];
    const aiGovernance = administrationRoutes.find(
      (route) => route.path === '/administration/ai',
    );

    expect(aiGovernance?.name).toBe('ai-governance');
    expect(aiGovernance?.routes?.[0]).toEqual({
      path: '/administration/ai',
      redirect: '/administration/ai/models',
    });
    expect(aiGovernance?.routes?.slice(1).map((route) => route.path)).toEqual([
      '/administration/ai/models',
      '/administration/ai/policies',
      '/administration/ai/usage',
      '/administration/ai/vectors',
      '/administration/ai/audit',
      '/administration/ai/data-tasks',
    ]);
    expect(
      administrationRoutes.filter((route) =>
        route.path?.startsWith('/administration/ai/'),
      ),
    ).toHaveLength(0);
  });
});
