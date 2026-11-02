export default defineNuxtPlugin((nuxtApp) => {
  const observers = new WeakMap<HTMLElement, IntersectionObserver>()
  nuxtApp.vueApp.directive('reveal', {
    mounted(element: HTMLElement, binding) {
      if (
        matchMedia('(prefers-reduced-motion: reduce)').matches ||
        !('IntersectionObserver' in window)
      )
        return
      element.style.setProperty(
        '--reveal-delay',
        `${Number(binding.value) || 0}ms`,
      )
      const observer = new IntersectionObserver(
        (entries) => {
          if (!entries.some((entry) => entry.isIntersecting)) return
          element.classList.add('reveal-in')
          observer.disconnect()
        },
        { threshold: 0.08 },
      )
      observer.observe(element)
      observers.set(element, observer)
    },
    unmounted(element: HTMLElement) {
      observers.get(element)?.disconnect()
    },
    getSSRProps() {
      return {}
    },
  })
})
