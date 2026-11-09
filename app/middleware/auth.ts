export default defineNuxtRouteMiddleware(async to => {
  if (to.path === '/login' || to.path === '/api/auth/login') return

  const { loggedIn, fetch } = useUserSession()
  if (!loggedIn.value) {
    await fetch()
  }
  if (!loggedIn.value) {
    return navigateTo({ path: '/login', query: { redirect: to.fullPath } })
  }
})
