<template>
  <section class="quote-page">
    <div class="quote-card">
      <h1>Tariff Quote Calculator</h1>
      <p class="quote-help">Enter origin/destination and vehicle weight in pounds.</p>

      <form class="quote-form" @submit.prevent="calculateRouteAndQuote">
        <label>
          Origin Address
          <input
            v-model="originInput"
            type="text"
            autocomplete="street-address"
            placeholder="e.g. Seattle, WA"
          >
        </label>

        <label>
          Destination Address
          <input
            v-model="destinationInput"
            type="text"
            autocomplete="street-address"
            placeholder="e.g. Portland, OR"
          >
        </label>

        <label>
          Miles
          <input
            v-model="milesInput"
            type="number"
            inputmode="decimal"
            min="0"
            step="any"
            readonly
            placeholder="Calculated from route"
          >
        </label>

        <label>
          Weight (lbs)
          <input
            v-model="weightInput"
            type="number"
            inputmode="decimal"
            min="0"
            step="any"
            placeholder="e.g. 7200"
          >
        </label>

        <button type="submit" :disabled="isSubmitDisabled">
          {{ loadingRoute ? 'Building Route...' : 'Build Route & Calculate Quote' }}
        </button>
      </form>

      <p v-if="routeInputError" class="status status-error">{{ routeInputError }}</p>
      <p v-else-if="weightInputError" class="status status-error">{{ weightInputError }}</p>
      <p v-else-if="serverError" class="status status-error">{{ serverError }}</p>
      <p v-else-if="loadingQuote" class="status">Updating quote...</p>

      <div v-if="routeSummary" class="route-summary">
        <p><strong>Route:</strong> {{ routeSummary }}</p>
        <p><strong>Distance:</strong> {{ milesInput }} miles</p>
      </div>

      <div class="map-wrap">
        <div ref="mapContainer" class="route-map" />
      </div>

      <div v-if="quote" class="quote-result">
        <p><strong>Per Mile Rate (per 100 lbs):</strong> {{ formatMoney(quote.perMileRate) }}</p>
        <p><strong>Total Cost:</strong> {{ formatMoney(quote.totalCost) }}</p>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
interface QuoteResult {
  perMileRate: number
  totalCost: number
}

declare global {
  interface Window {
    google?: any
  }
}

const config = useRuntimeConfig()
const googleMapsApiKey = config.public.googleMapsApiKey || ''
const originInput = ref('')
const destinationInput = ref('')
const milesInput = ref('')
const weightInput = ref('')
const loadingRoute = ref(false)
const loadingQuote = ref(false)
const quote = ref<QuoteResult | null>(null)
const serverError = ref('')
const routeSummary = ref('')
const mapContainer = ref<HTMLElement | null>(null)
let map: any
let directionsService: any
let directionsRenderer: any
let geocoder: any

const parsedMiles = computed(() => Number(milesInput.value))
const parsedWeight = computed(() => Number(weightInput.value))

const routeInputError = computed(() => {
  if (!originInput.value || !destinationInput.value) return ''

  if (originInput.value.trim().length < 3 || destinationInput.value.trim().length < 3) {
    return 'Please enter fuller origin and destination addresses.'
  }

  return ''
})

const weightInputError = computed(() => {
  if (!weightInput.value) return ''

  if (!Number.isFinite(parsedWeight.value) || parsedWeight.value < 0) {
    return 'Weight must be a non-negative number.'
  }

  return ''
})

const isSubmitDisabled = computed(() => {
  if (loadingRoute.value || loadingQuote.value) return true
  if (!originInput.value || !destinationInput.value || !weightInput.value) return true
  if (routeInputError.value.length > 0) return true
  return weightInputError.value.length > 0
})

function formatMoney(value: number) {
  return `$${value.toFixed(2)}`
}

async function loadGoogleMaps() {
  if (import.meta.server) return
  if (window.google?.maps) return
  if (!googleMapsApiKey) throw new Error('Missing Google Maps API key: set GOOGLE_API_KEY (or NUXT_PUBLIC_GOOGLE_MAPS_API_KEY)')

  await new Promise<void>((resolve, reject) => {
    const existingScript = document.getElementById('google-maps-js') as HTMLScriptElement | null
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve(), { once: true })
      existingScript.addEventListener('error', () => reject(new Error('Google Maps failed to load')), { once: true })
      if (window.google?.maps) resolve()
      return
    }

    const script = document.createElement('script')
    script.id = 'google-maps-js'
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(googleMapsApiKey)}`
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Google Maps failed to load'))
    document.body.appendChild(script)
  })
}

function ensureMap() {
  if (!mapContainer.value || !window.google?.maps || map) return

  const google = window.google
  map = new google.maps.Map(mapContainer.value, {
    center: { lat: 39.5, lng: -98.35 },
    zoom: 4,
    mapTypeControl: false,
    streetViewControl: false,
    fullscreenControl: false,
  })

  directionsService = new google.maps.DirectionsService()
  directionsRenderer = new google.maps.DirectionsRenderer({
    map,
  })
  geocoder = new google.maps.Geocoder()
}

async function geocodeWithFallback(address: string) {
  if (!window.google?.maps || !geocoder) throw new Error('Geocoder is not ready yet.')

  const google = window.google
  const queries = [address, `${address}, USA`]

  for (const query of queries) {
    const result = await geocoder.geocode({
      address: query,
      region: 'US',
    })

    const top = result?.results?.[0]
    if (top?.place_id) {
      return {
        placeId: top.place_id,
        formattedAddress: top.formatted_address || query,
      }
    }
  }

  throw new Error(`Could not geocode address: ${address}`)
}

async function fetchQuote() {
  if (!milesInput.value || !weightInput.value || weightInputError.value) return

  serverError.value = ''
  loadingQuote.value = true

  try {
    quote.value = await $fetch<QuoteResult>('/api/quote', {
      query: {
        miles: parsedMiles.value,
        weight: parsedWeight.value,
      },
    })
  }
  catch (error) {
    quote.value = null
    const message = error instanceof Error ? error.message : 'Unable to calculate quote.'
    serverError.value = message
  }
  finally {
    loadingQuote.value = false
  }
}

async function calculateRouteAndQuote() {
  if (isSubmitDisabled.value) return

  serverError.value = ''
  loadingRoute.value = true

  try {
    if (!window.google?.maps || !directionsService || !directionsRenderer) {
      throw new Error('Map is not ready yet.')
    }

    const google = window.google
    const resolvedOrigin = await geocodeWithFallback(originInput.value.trim())
    const resolvedDestination = await geocodeWithFallback(destinationInput.value.trim())

    const route = await directionsService.route({
      origin: { placeId: resolvedOrigin.placeId },
      destination: { placeId: resolvedDestination.placeId },
      travelMode: google.maps.TravelMode.DRIVING,
      unitSystem: google.maps.UnitSystem.IMPERIAL,
    })
    directionsRenderer.setDirections(route)

    const legs = route?.routes?.[0]?.legs || []
    const distanceMeters = legs.reduce((total: number, leg: any) => {
      return total + Number(leg?.distance?.value || 0)
    }, 0)

    if (distanceMeters <= 0) {
      throw new Error('Unable to calculate route distance.')
    }

    const firstLeg = legs[0]
    const lastLeg = legs[legs.length - 1]
    milesInput.value = (distanceMeters * 0.000621371).toFixed(2)
    routeSummary.value = `${firstLeg?.start_address || resolvedOrigin.formattedAddress} -> ${lastLeg?.end_address || resolvedDestination.formattedAddress}`

    await fetchQuote()
  }
  catch (error) {
    quote.value = null
    routeSummary.value = ''
    const rawMessage = error instanceof Error ? error.message : 'Unable to calculate route.'
    const message = rawMessage.includes('ZERO_RESULTS')
      ? 'No drivable route was found. Try fuller street addresses with city/state/ZIP.'
      : rawMessage
    serverError.value = message
  }
  finally {
    loadingRoute.value = false
  }
}

let debounceTimer: ReturnType<typeof setTimeout> | undefined

watch(weightInput, () => {
  if (debounceTimer) clearTimeout(debounceTimer)

  if (weightInputError.value || !milesInput.value || !weightInput.value) {
    quote.value = null
    serverError.value = ''
    return
  }

  debounceTimer = setTimeout(() => {
    fetchQuote()
  }, 250)
})

onMounted(async () => {
  try {
    await loadGoogleMaps()
    ensureMap()
  }
  catch (error) {
    serverError.value = error instanceof Error ? error.message : 'Unable to load map.'
  }
})

onBeforeUnmount(() => {
  if (debounceTimer) clearTimeout(debounceTimer)
  if (directionsRenderer) directionsRenderer.setMap(null)
  map = undefined
  directionsService = undefined
  directionsRenderer = undefined
  geocoder = undefined
})
</script>
