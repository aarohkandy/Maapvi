const DEV_COUNTDOWN_ENABLED = false;

(function () {
  "use strict";

  const COUNTDOWN_TARGET_UTC = Date.parse("2026-04-18T04:00:00Z");
  const HOSTED_RELEASE_LOCK_ENABLED = true;
  const LOCAL_DEV_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
  const INTRO_VISIBLE_MS = 2800;
  const INTRO_FADE_MS = 600;
  const INTRO_WAIT_STATUS_DELAY_MS = 3200;
  const AUTO_ROTATE_DELAY_MS = 4000;
  const FETCH_TIMEOUT_MS = 10000;
  const LIVE_TEXTURE_TIMEOUT_MS = 5500;
  const STATIC_TEXTURE_TIMEOUT_MS = 7000;
  const BOOT_TEXTURE_DEADLINE_MS = 8500;
  const TEXTURE_SIZE = { width: 6144, height: 3072 };
  const STATIC_TEXTURE_URL = "https://assets.science.nasa.gov/content/dam/science/esd/eo/images/bmng/bmng-base/april/world.200404.3x5400x2700.jpg";
  const LIVE_TEXTURE_URL = buildLiveTextureUrl();
  const RADAR_SOURCE_URL = "https://api.rainviewer.com/public/weather-maps.json";
  const VIEW_MODES = {
    globe: "globe",
    panda: "panda",
    nudibranch: "nudibranch",
    radar: "radar",
    history: "history"
  };
  const CLICK_MARKER_PIXELS = 18;
  const MARKER_PIXELS = {
    panda: 12,
    pandaSelected: 16,
    nudibranch: 13,
    nudibranchSelected: 17
  };
  const GLOBE_CACHE = new Map();
  const RADAR_CACHE = new Map();
  const HISTORY_CACHE = new Map();
  const PHOTO_CACHE = new Map();
  const PANDA_LOCATIONS = Array.isArray(window.PANDA_LOCATIONS) ? window.PANDA_LOCATIONS : [];
  const NUDIBRANCH_REGIONS = Array.isArray(window.NUDIBRANCH_REGIONS) ? window.NUDIBRANCH_REGIONS : [];

  const elements = {
    appShell: document.getElementById("app-shell"),
    globeStage: document.getElementById("globe-stage"),
    globeFallback: document.getElementById("globe-fallback"),
    spinner: document.getElementById("canvas-spinner"),
    textureBadge: document.getElementById("texture-badge"),
    countdownScreen: document.getElementById("countdown-screen"),
    countdownNudibranchField: document.getElementById("countdown-nudibranch-field"),
    countdownTime: document.getElementById("countdown-time"),
    introScreen: document.getElementById("intro-screen"),
    introStatus: document.getElementById("intro-status"),
    nudibranchField: document.getElementById("nudibranch-field"),
    panel: document.getElementById("info-panel"),
    panelScroll: document.querySelector(".panel-scroll"),
    closeButton: document.getElementById("panel-close"),
    layerButtons: Array.from(document.querySelectorAll(".layer-selector-item")),
    leftDetailPanel: document.getElementById("left-detail-panel"),
    leftDetailContent: document.getElementById("left-detail-content")
  };

  const state = {
    appVisible: false,
    viewMode: VIEW_MODES.globe,
    textureMode: "loading",
    needsRender: true,
    animationFrame: 0,
    autoRotateLoop: false,
    autoRotateResumeTimer: 0,
    pointerDown: null,
    isAutoRotateTick: false,
    rotationLocked: false,
    globeReady: false,
    globeReadyPromise: null,
    resolveGlobeReady: null,
    sceneReady: false,
    selectionToken: 0,
    selectedPandaId: "",
    selectedRegionId: "",
    camera: null,
    controls: null,
    renderer: null,
    scene: null,
    earthMesh: null,
    clickMarker: null,
    pandaMarkers: [],
    nudibranchMarkers: [],
    pandaGroup: null,
    nudibranchGroup: null,
    markerTextures: {},
    spriteWorldPosition: new THREE.Vector3()
  };

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    bindUi();
    startSequence();
  }

  function bindUi() {
    elements.closeButton.addEventListener("click", closePanel);
    elements.layerButtons.forEach((button) => {
      button.addEventListener("click", function () {
        setViewMode(button.dataset.view || VIEW_MODES.globe);
      });
    });
  }

  function createGlobeReadyGate() {
    state.globeReadyPromise = new Promise((resolve) => {
      state.resolveGlobeReady = resolve;
    });
  }

  async function startSequence() {
    if (isHostedReleaseLocked(Date.now(), window.location)) {
      populateNudibranchs(elements.countdownNudibranchField, { min: 5, max: 9 });
      await runCountdown({ includeDays: true });
    } else if (DEV_COUNTDOWN_ENABLED && isLocalEnvironment(window.location)) {
      populateNudibranchs(elements.countdownNudibranchField, { min: 5, max: 9 });
      await runCountdown({ includeDays: true });
    } else {
      hideCountdownScreen();
    }

    populateNudibranchs(elements.nudibranchField, { min: 4, max: 8 });
    renderModeOverviewState();
    closeLeftDetail();
    createGlobeReadyGate();

    try {
      initializeScene();
    } catch (error) {
      console.error("Scene bootstrap failed", error);
      handleSceneBootFailure();
    }

    await runIntro();
    revealApp();
  }

  function isLocalEnvironment(locationLike) {
    if (!locationLike || typeof locationLike !== "object") {
      return false;
    }

    if (locationLike.protocol === "file:") {
      return true;
    }

    return LOCAL_DEV_HOSTS.has(String(locationLike.hostname || "").toLowerCase());
  }

  function isHostedReleaseLocked(nowMs, locationLike) {
    return HOSTED_RELEASE_LOCK_ENABLED &&
      !isLocalEnvironment(locationLike) &&
      nowMs < COUNTDOWN_TARGET_UTC;
  }

  function runCountdown(options) {
    const settings = Object.assign({
      includeDays: true
    }, options);
    const screen = elements.countdownScreen;

    screen.classList.remove("screen-hidden", "is-exiting");
    screen.setAttribute("aria-hidden", "false");

    return new Promise((resolve) => {
      const tick = () => {
        const remaining = Math.max(0, COUNTDOWN_TARGET_UTC - Date.now());
        renderCountdown(remaining, settings.includeDays);

        if (remaining <= 0) {
          screen.classList.add("is-exiting");
          window.setTimeout(() => {
            hideCountdownScreen();
            resolve();
          }, INTRO_FADE_MS);
          return;
        }

        const nextTickDelay = remaining % 1000 || 1000;
        window.setTimeout(tick, nextTickDelay);
      };

      tick();
    });
  }

  function hideCountdownScreen() {
    elements.countdownScreen.classList.remove("is-exiting");
    elements.countdownScreen.classList.add("screen-hidden");
    elements.countdownScreen.setAttribute("aria-hidden", "true");
  }

  window.MaapviRuntime = Object.freeze({
    isLocalEnvironment,
    isHostedReleaseLocked,
    releaseTargetUtc: COUNTDOWN_TARGET_UTC
  });

  async function runIntro() {
    const waitingTimer = window.setTimeout(() => {
      elements.introScreen.classList.add("is-waiting");
    }, INTRO_WAIT_STATUS_DELAY_MS);

    elements.introScreen.classList.add("is-active");
    elements.introScreen.classList.remove("screen-hidden");
    elements.introScreen.classList.remove("is-exiting");

    await Promise.all([wait(INTRO_VISIBLE_MS), state.globeReadyPromise]);

    window.clearTimeout(waitingTimer);
    elements.introScreen.classList.remove("is-waiting");
    elements.introScreen.classList.add("is-exiting");
    await wait(INTRO_FADE_MS);
    elements.introScreen.classList.remove("is-active");
    elements.introScreen.classList.add("screen-hidden");
  }

  function revealApp() {
    state.appVisible = true;
    elements.appShell.classList.add("is-visible");
    elements.appShell.setAttribute("aria-hidden", "false");
    startAutoRotate();
    requestRender();
  }

  function initializeScene() {
    if (!window.THREE || !THREE.OrbitControls) {
      throw new Error("Three.js boot assets are unavailable");
    }

    elements.globeStage.classList.remove("has-fallback");
    elements.globeFallback.setAttribute("aria-hidden", "true");

    const stage = elements.globeStage;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(stage.clientWidth, stage.clientHeight);
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.setClearColor(0x0a0a0f, 1);
    stage.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, stage.clientWidth / stage.clientHeight, 0.1, 100);
    camera.position.set(0, 0.12, 4.35);

    const controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enablePan = false;
    controls.enableDamping = false;
    controls.minDistance = 2.9;
    controls.maxDistance = 6.2;
    controls.autoRotate = false;
    controls.autoRotateSpeed = 0.458;

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.1);
    directionalLight.position.set(5, 3, 5);
    scene.add(directionalLight);

    addStarfield(scene);

    const earthMesh = new THREE.Mesh(
      new THREE.SphereGeometry(2, 64, 64),
      new THREE.MeshPhongMaterial({ color: 0xffffff })
    );
    scene.add(earthMesh);

    const atmosphere = new THREE.Mesh(
      new THREE.SphereGeometry(2.06, 64, 64),
      new THREE.MeshPhongMaterial({
        color: 0x3d2080,
        transparent: true,
        opacity: 0.08,
        depthWrite: false
      })
    );
    scene.add(atmosphere);

    const pandaGroup = new THREE.Group();
    const nudibranchGroup = new THREE.Group();
    scene.add(pandaGroup);
    scene.add(nudibranchGroup);

    state.camera = camera;
    state.controls = controls;
    state.renderer = renderer;
    state.scene = scene;
    state.earthMesh = earthMesh;
    state.pandaGroup = pandaGroup;
    state.nudibranchGroup = nudibranchGroup;
    state.sceneReady = true;
    state.markerTextures = createMarkerTextures();

    buildPandaMarkers();
    buildNudibranchMarkers();
    syncViewModeUi();
    syncMarkerVisibility();

    controls.addEventListener("change", onControlsChange);
    controls.addEventListener("start", onInteractionStart);
    controls.addEventListener("end", onInteractionEnd);

    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerCancel);
    window.addEventListener("resize", onResize);

    loadEarthTexture(earthMesh.material, renderer)
      .catch(() => {
        earthMesh.material.color.set(0x536f98);
        earthMesh.material.needsUpdate = true;
        setTextureMode("static");
      })
      .finally(() => {
        elements.spinner.classList.add("is-hidden");
        markGlobeReady();
        requestRender();
      });

    requestRender();
  }

  function addStarfield(scene) {
    const starGeometry = new THREE.BufferGeometry();
    const positions = new Float32Array(2000 * 3);

    for (let index = 0; index < 2000; index += 1) {
      const radius = 12 + Math.random() * 18;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const offset = index * 3;

      positions[offset] = radius * Math.sin(phi) * Math.cos(theta);
      positions[offset + 1] = radius * Math.cos(phi);
      positions[offset + 2] = radius * Math.sin(phi) * Math.sin(theta);
    }

    starGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

    scene.add(new THREE.Points(
      starGeometry,
      new THREE.PointsMaterial({
        color: 0xffffff,
        size: 0.045,
        transparent: true,
        opacity: 0.82,
        sizeAttenuation: true
      })
    ));
  }

  async function loadEarthTexture(material, renderer) {
    let allowTextureSwap = true;
    const sequence = (async function () {
      const fallbackPromise = loadTextureWithTimeout(STATIC_TEXTURE_URL, STATIC_TEXTURE_TIMEOUT_MS);

      try {
        const liveTexture = await loadTextureWithTimeout(LIVE_TEXTURE_URL, LIVE_TEXTURE_TIMEOUT_MS);
        if (!allowTextureSwap) {
          return;
        }
        applyTexture(material, renderer, liveTexture);
        setTextureMode("live");
      } catch (error) {
        const fallbackTexture = await fallbackPromise;
        if (!allowTextureSwap) {
          return;
        }
        applyTexture(material, renderer, fallbackTexture);
        setTextureMode("static");
      }
    })();

    await Promise.race([
      sequence,
      wait(BOOT_TEXTURE_DEADLINE_MS).then(function () {
        allowTextureSwap = false;
        throw new Error("Texture loading took too long");
      })
    ]);
  }

  function applyTexture(material, renderer, texture) {
    texture.encoding = THREE.sRGBEncoding;
    texture.anisotropy = Math.min(12, renderer.capabilities.getMaxAnisotropy());
    material.map = texture;
    material.needsUpdate = true;
  }

  function loadTextureWithTimeout(url, timeoutMs) {
    return new Promise((resolve, reject) => {
      let settled = false;
      const image = new Image();
      const timer = window.setTimeout(() => {
        if (settled) {
          return;
        }
        settled = true;
        image.src = "";
        reject(new Error("Texture load timed out"));
      }, timeoutMs);

      image.crossOrigin = "anonymous";
      image.decoding = "async";
      image.onload = function () {
        if (settled) {
          return;
        }
        settled = true;
        window.clearTimeout(timer);
        const texture = new THREE.Texture(image);
        texture.needsUpdate = true;
        resolve(texture);
      };
      image.onerror = function (error) {
        if (settled) {
          return;
        }
        settled = true;
        window.clearTimeout(timer);
        reject(error || new Error("Texture load failed"));
      };
      image.src = url;
    });
  }

  function handleSceneBootFailure() {
    setTextureMode("static");
    elements.globeStage.classList.add("has-fallback");
    elements.globeFallback.setAttribute("aria-hidden", "false");
    elements.spinner.classList.add("is-hidden");
    markGlobeReady();
  }

  function setTextureMode(mode) {
    state.textureMode = mode;
    elements.textureBadge.textContent = mode;
  }

  function markGlobeReady() {
    if (state.globeReady) {
      return;
    }

    state.globeReady = true;
    if (state.resolveGlobeReady) {
      state.resolveGlobeReady();
      state.resolveGlobeReady = null;
    }
  }

  function onResize() {
    if (!state.sceneReady) {
      return;
    }

    const stage = elements.globeStage;
    state.camera.aspect = stage.clientWidth / stage.clientHeight;
    state.camera.updateProjectionMatrix();
    state.renderer.setSize(stage.clientWidth, stage.clientHeight);
    requestRender();
  }

  function onPointerDown(event) {
    state.pointerDown = {
      x: event.clientX,
      y: event.clientY,
      id: event.pointerId
    };
    onInteractionStart();
  }

  function onPointerUp(event) {
    if (!state.pointerDown || event.pointerId !== state.pointerDown.id) {
      return;
    }

    const deltaX = event.clientX - state.pointerDown.x;
    const deltaY = event.clientY - state.pointerDown.y;
    const moved = Math.hypot(deltaX, deltaY) > 6;
    const pointer = state.pointerDown;
    state.pointerDown = null;

    if (!moved) {
      handleGlobeSelection(pointer.x, pointer.y);
    }

    onInteractionEnd();
  }

  function onPointerCancel() {
    state.pointerDown = null;
    onInteractionEnd();
  }

  function onInteractionStart() {
    window.clearTimeout(state.autoRotateResumeTimer);
    state.autoRotateLoop = false;
    if (state.controls) {
      state.controls.autoRotate = false;
    }
    requestRender();
  }

  function onInteractionEnd() {
    if (!state.appVisible || state.rotationLocked) {
      return;
    }

    window.clearTimeout(state.autoRotateResumeTimer);
    state.autoRotateResumeTimer = window.setTimeout(function () {
      startAutoRotate();
    }, AUTO_ROTATE_DELAY_MS);
  }

  function startAutoRotate() {
    if (!state.sceneReady || !state.appVisible || state.rotationLocked) {
      return;
    }

    state.autoRotateLoop = true;
    if (state.controls) {
      state.controls.autoRotate = true;
    }
    requestRender();
  }

  function lockAutoRotate() {
    state.rotationLocked = true;
    window.clearTimeout(state.autoRotateResumeTimer);
    state.autoRotateLoop = false;
    if (state.controls) {
      state.controls.autoRotate = false;
    }
    requestRender();
  }

  function unlockAutoRotate() {
    state.rotationLocked = false;
    window.clearTimeout(state.autoRotateResumeTimer);
    if (state.appVisible) {
      state.autoRotateResumeTimer = window.setTimeout(function () {
        startAutoRotate();
      }, AUTO_ROTATE_DELAY_MS);
    }
  }

  function requestRender() {
    state.needsRender = true;
    if (!state.animationFrame) {
      state.animationFrame = window.requestAnimationFrame(renderLoop);
    }
  }

  function onControlsChange() {
    if (state.isAutoRotateTick) {
      state.needsRender = true;
      return;
    }

    requestRender();
  }

  function renderLoop() {
    state.animationFrame = 0;

    if (!state.sceneReady) {
      return;
    }

    if (state.autoRotateLoop && state.controls) {
      state.isAutoRotateTick = true;
      state.controls.update();
      state.isAutoRotateTick = false;
      state.needsRender = true;
    }

    if (state.needsRender) {
      updateMarkerScales();
      state.renderer.render(state.scene, state.camera);
      state.needsRender = false;
    }

    if (state.autoRotateLoop && state.appVisible) {
      state.animationFrame = window.requestAnimationFrame(renderLoop);
    }
  }

  function setViewMode(mode) {
    if (!VIEW_MODES[mode]) {
      return;
    }

    state.selectionToken += 1;
    state.viewMode = mode;
    state.selectedPandaId = "";
    state.selectedRegionId = "";
    clearClickMarker();
    updatePandaMarkerSelection("");
    updateNudibranchMarkerSelection("");
    closeLeftDetail();
    syncViewModeUi();
    syncMarkerVisibility();
    renderModeOverviewState();
    openPanel();
    unlockAutoRotate();
    requestRender();
  }

  function syncViewModeUi() {
    elements.layerButtons.forEach((button) => {
      const isActive = button.dataset.view === state.viewMode;
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-pressed", isActive ? "true" : "false");
    });
  }

  function syncMarkerVisibility() {
    if (state.clickMarker) {
      const usesClickMarker =
        state.viewMode === VIEW_MODES.globe ||
        state.viewMode === VIEW_MODES.radar ||
        state.viewMode === VIEW_MODES.history;
      state.clickMarker.visible = Boolean(state.clickMarker.userData.active && usesClickMarker);
    }

    if (state.pandaGroup) {
      state.pandaGroup.visible = state.viewMode === VIEW_MODES.panda;
    }

    if (state.nudibranchGroup) {
      state.nudibranchGroup.visible = state.viewMode === VIEW_MODES.nudibranch;
    }
  }

  function handleGlobeSelection(clientX, clientY) {
    if (!state.sceneReady) {
      return;
    }

    const rect = state.renderer.domElement.getBoundingClientRect();
    const pointer = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1
    );
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(pointer, state.camera);
    const earthHits = raycaster.intersectObject(state.earthMesh, false);

    if (state.viewMode === VIEW_MODES.panda) {
      const pandaHits = raycaster.intersectObjects(state.pandaMarkers, false);
      if (!pandaHits.length) {
        return;
      }

      const pandaHit = pandaHits[0];
      const earthHit = earthHits[0];
      const isVisible = !earthHit || pandaHit.distance <= earthHit.distance + 0.02;
      if (!isVisible) {
        return;
      }

      selectPandaLocation(pandaHit.object.userData.location);
      return;
    }

    if (state.viewMode === VIEW_MODES.nudibranch) {
      const nudibranchHits = raycaster.intersectObjects(state.nudibranchMarkers, false);
      if (!nudibranchHits.length) {
        return;
      }

      const nudibranchHit = nudibranchHits[0];
      const earthHit = earthHits[0];
      const isVisible = !earthHit || nudibranchHit.distance <= earthHit.distance + 0.02;
      if (!isVisible) {
        return;
      }

      selectNudibranchRegion(nudibranchHit.object.userData.region);
      return;
    }

    if (!earthHits.length) {
      return;
    }

    const coords = pointToLatLng(state.earthMesh.worldToLocal(earthHits[0].point.clone()), 2);
    const lat = coords.lat;
    const lng = coords.lng;

    if (state.viewMode === VIEW_MODES.globe) {
      selectGlobeLocation(lat, lng);
    } else if (state.viewMode === VIEW_MODES.radar) {
      selectRadarLocation(lat, lng);
    } else if (state.viewMode === VIEW_MODES.history) {
      selectHistoryLocation(lat, lng);
    }
  }

  function selectGlobeLocation(lat, lng) {
    const token = createSelectionToken();
    const biome = getBiome(lat, lng);

    lockAutoRotate();
    state.selectedPandaId = "";
    state.selectedRegionId = "";
    updatePandaMarkerSelection("");
    updateNudibranchMarkerSelection("");
    closeLeftDetail();
    placeClickMarker(lat, lng, "globe");
    openPanel();
    renderGlobeLoadingState(lat, lng, biome);

    getGlobePayload(lat, lng, biome)
      .then(function (payload) {
        if (!isActiveSelection(token, VIEW_MODES.globe)) {
          return;
        }
        renderGlobeResolvedState(payload);
      })
      .catch(function () {
        if (!isActiveSelection(token, VIEW_MODES.globe)) {
          return;
        }

        renderGlobeResolvedState(createFallbackGlobePayload(lat, lng, biome));
      });
  }

  function selectPandaLocation(location) {
    createSelectionToken();
    lockAutoRotate();
    clearClickMarker();
    closeLeftDetail();
    state.selectedPandaId = location.id;
    state.selectedRegionId = "";
    updatePandaMarkerSelection(location.id);
    updateNudibranchMarkerSelection("");
    openPanel();
    renderPandaLocation(location);
  }

  function selectNudibranchRegion(region) {
    const token = createSelectionToken();

    lockAutoRotate();
    clearClickMarker();
    state.selectedRegionId = region.id;
    state.selectedPandaId = "";
    updatePandaMarkerSelection("");
    updateNudibranchMarkerSelection(region.id);
    openPanel();
    renderNudibranchRegionPanel(region);
    renderNudibranchSpeciesList(region, [], true);

    getNudibranchRegionCards(region).then(function (cards) {
      if (!isActiveSelection(token, VIEW_MODES.nudibranch) || state.selectedRegionId !== region.id) {
        return;
      }
      renderNudibranchSpeciesList(region, cards, false);
    }).catch(function () {
      if (!isActiveSelection(token, VIEW_MODES.nudibranch) || state.selectedRegionId !== region.id) {
        return;
      }
      renderNudibranchSpeciesList(region, [], false);
    });
  }

  function selectRadarLocation(lat, lng) {
    const token = createSelectionToken();

    lockAutoRotate();
    closeLeftDetail();
    placeClickMarker(lat, lng, "radar");
    openPanel();
    renderRadarLoadingState(lat, lng);

    getRadarPayload(lat, lng)
      .then(function (payload) {
        if (!isActiveSelection(token, VIEW_MODES.radar)) {
          return;
        }
        renderRadarResolvedState(payload);
      })
      .catch(function () {
        if (!isActiveSelection(token, VIEW_MODES.radar)) {
          return;
        }
        renderRadarResolvedState(createFallbackRadarPayload(lat, lng));
      });
  }

  function selectHistoryLocation(lat, lng) {
    const token = createSelectionToken();

    lockAutoRotate();
    closeLeftDetail();
    placeClickMarker(lat, lng, "history");
    openPanel();
    renderHistoryLoadingState(lat, lng);

    getHistoryPayload(lat, lng)
      .then(function (payload) {
        if (!isActiveSelection(token, VIEW_MODES.history)) {
          return;
        }
        renderHistoryResolvedState(payload);
      })
      .catch(function () {
        if (!isActiveSelection(token, VIEW_MODES.history)) {
          return;
        }
        renderHistoryResolvedState(createFallbackHistoryPayload(lat, lng));
      });
  }

  function createSelectionToken() {
    state.selectionToken += 1;
    return state.selectionToken;
  }

  function isActiveSelection(token, mode) {
    return token === state.selectionToken && state.viewMode === mode;
  }

  function placeClickMarker(lat, lng, textureKey) {
    if (!state.clickMarker) {
      state.clickMarker = new THREE.Sprite(new THREE.SpriteMaterial({
        map: state.markerTextures[textureKey] || state.markerTextures.globe,
        transparent: true,
        depthWrite: false,
        depthTest: true,
        toneMapped: false
      }));
      state.clickMarker.renderOrder = 3;
      state.clickMarker.userData.active = false;
      state.scene.add(state.clickMarker);
    }

    state.clickMarker.material.map = state.markerTextures[textureKey] || state.markerTextures.globe;
    state.clickMarker.material.needsUpdate = true;
    state.clickMarker.position.copy(latLngToVector3(lat, lng, 2.065));
    state.clickMarker.userData.pixelSize = CLICK_MARKER_PIXELS;
    state.clickMarker.userData.active = true;
    syncMarkerVisibility();
    requestRender();
  }

  function clearClickMarker() {
    if (!state.clickMarker) {
      return;
    }

    state.clickMarker.userData.active = false;
    state.clickMarker.visible = false;
    requestRender();
  }

  function buildPandaMarkers() {
    state.pandaMarkers.forEach(function (marker) {
      state.pandaGroup.remove(marker);
      marker.material.dispose();
    });
    state.pandaMarkers = [];

    PANDA_LOCATIONS.forEach(function (location) {
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
        map: state.markerTextures[getPandaTextureKey(location.kind)],
        transparent: true,
        depthWrite: false,
        depthTest: true,
        toneMapped: false
      }));
      sprite.position.copy(latLngToVector3(location.lat, location.lng, 2.058));
      sprite.userData = {
        type: "panda",
        location: location,
        pixelSize: MARKER_PIXELS.panda,
        baseTextureKey: getPandaTextureKey(location.kind)
      };
      sprite.renderOrder = 3;
      state.pandaGroup.add(sprite);
      state.pandaMarkers.push(sprite);
    });
  }

  function buildNudibranchMarkers() {
    state.nudibranchMarkers.forEach(function (marker) {
      state.nudibranchGroup.remove(marker);
      marker.material.dispose();
    });
    state.nudibranchMarkers = [];

    NUDIBRANCH_REGIONS.forEach(function (region) {
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
        map: state.markerTextures.nudibranch,
        transparent: true,
        depthWrite: false,
        depthTest: true,
        toneMapped: false
      }));
      sprite.position.copy(latLngToVector3(region.lat, region.lng, 2.058));
      sprite.userData = {
        type: "nudibranch",
        region: region,
        pixelSize: MARKER_PIXELS.nudibranch
      };
      sprite.renderOrder = 3;
      state.nudibranchGroup.add(sprite);
      state.nudibranchMarkers.push(sprite);
    });
  }

  function updatePandaMarkerSelection(activeId) {
    state.pandaMarkers.forEach(function (marker) {
      const selected = marker.userData.location.id === activeId;
      marker.userData.pixelSize = selected ? MARKER_PIXELS.pandaSelected : MARKER_PIXELS.panda;
      marker.material.map = selected
        ? state.markerTextures.pandaActive
        : state.markerTextures[marker.userData.baseTextureKey];
      marker.material.needsUpdate = true;
    });
    requestRender();
  }

  function updateNudibranchMarkerSelection(activeId) {
    state.nudibranchMarkers.forEach(function (marker) {
      const selected = marker.userData.region.id === activeId;
      marker.userData.pixelSize = selected ? MARKER_PIXELS.nudibranchSelected : MARKER_PIXELS.nudibranch;
      marker.material.map = selected ? state.markerTextures.nudibranchActive : state.markerTextures.nudibranch;
      marker.material.needsUpdate = true;
    });
    requestRender();
  }

  function updateMarkerScales() {
    if (!state.sceneReady || !state.camera) {
      return;
    }

    if (state.clickMarker && state.clickMarker.visible) {
      setSpriteScreenSize(state.clickMarker, state.clickMarker.userData.pixelSize || CLICK_MARKER_PIXELS);
    }

    state.pandaMarkers.forEach(function (marker) {
      if (marker.visible && state.pandaGroup.visible) {
        setSpriteScreenSize(marker, marker.userData.pixelSize || MARKER_PIXELS.panda);
      }
    });

    state.nudibranchMarkers.forEach(function (marker) {
      if (marker.visible && state.nudibranchGroup.visible) {
        setSpriteScreenSize(marker, marker.userData.pixelSize || MARKER_PIXELS.nudibranch);
      }
    });
  }

  function setSpriteScreenSize(sprite, pixels) {
    const height = elements.globeStage.clientHeight || window.innerHeight || 1;
    const worldPosition = sprite.getWorldPosition(state.spriteWorldPosition);
    const distance = state.camera.position.distanceTo(worldPosition);
    const worldHeight = 2 * Math.tan(THREE.MathUtils.degToRad(state.camera.fov / 2)) * distance;
    const worldSize = Math.max(0.015, worldHeight * (pixels / height));
    sprite.scale.set(worldSize, worldSize, 1);
  }

  function openPanel() {
    elements.panel.classList.add("is-open");
    requestRender();
  }

  function closePanel() {
    elements.panel.classList.remove("is-open");
    closeLeftDetail();
    unlockAutoRotate();
    requestRender();
  }

  function setPanelContent(html) {
    elements.panelScroll.innerHTML = html;
    elements.panelScroll.scrollTop = 0;
    requestRender();
  }

  function openLeftDetail(html) {
    elements.leftDetailContent.innerHTML = html;
    elements.leftDetailContent.scrollTop = 0;
    elements.leftDetailPanel.classList.add("is-open");
  }

  function closeLeftDetail() {
    elements.leftDetailPanel.classList.remove("is-open");
    elements.leftDetailContent.innerHTML = "";
    requestRender();
  }

  function renderModeOverviewState() {
    if (state.viewMode === VIEW_MODES.globe) {
      renderGlobeOverviewState();
    } else if (state.viewMode === VIEW_MODES.panda) {
      renderPandaOverviewState();
    } else if (state.viewMode === VIEW_MODES.nudibranch) {
      renderNudibranchOverviewState();
    } else if (state.viewMode === VIEW_MODES.radar) {
      renderRadarOverviewState();
    } else {
      renderHistoryOverviewState();
    }
  }

  function renderGlobeOverviewState() {
    setPanelContent([
      '<header class="panel-header">',
      '  <h1 class="place-name">Globe</h1>',
      '  <p class="coords-line">Click anywhere on the planet and the panel will sketch the place, the weather, and the local life.</p>',
      "</header>",
      '<section class="biome-card">',
      '  <div class="biome-title-row"><div class="biome-title">Choose a horizon</div></div>',
      '  <div class="tag-row"><span class="tag ghost-tag">biome</span><span class="tag ghost-tag">climate</span></div>',
      '  <p class="biome-description">This is the free-wandering layer. It keeps the original place explorer, but now avoids impossible ocean wildlife and stays still once you choose a spot.</p>',
      "</section>"
    ].join(""));
  }

  function renderGlobeLoadingState(lat, lng, biome) {
    setPanelContent(renderGlobePanelHtml({
      title: "finding a place...",
      coordsText: formatCoordsHtml(lat, lng),
      biome: biome,
      climate: null,
      animals: { loading: true }
    }));
  }

  function renderGlobeResolvedState(payload) {
    setPanelContent(renderGlobePanelHtml({
      title: payload.place.title,
      coordsText: formatCoordsHtml(payload.coords.lat, payload.coords.lng),
      biome: payload.biome,
      climate: payload.climate,
      animals: payload.animals
    }));
  }

  function renderGlobePanelHtml(data) {
    return [
      '<header class="panel-header">',
      `  <h1 class="place-name">${escapeHtml(data.title)}</h1>`,
      `  <p class="coords-line">${data.coordsText}</p>`,
      "</header>",
      renderBiomeHtml(data.biome),
      '<section class="climate-section">',
      `  <div class="climate-row">${renderClimateHtml(data.climate)}</div>`,
      "</section>",
      '<section class="animals-section">',
      '  <div class="section-label">local life</div>',
      `  <div class="animals-grid">${renderAnimalsHtml(data.animals)}</div>`,
      "</section>"
    ].join("");
  }

  function renderPandaOverviewState() {
    const kinds = Array.from(new Set(PANDA_LOCATIONS.map(function (location) {
      return location.kind;
    })));

    setPanelContent([
      '<header class="panel-header">',
      '  <h1 class="place-name">Panda Tracker</h1>',
      `  <p class="coords-line">${escapeHtml(String(PANDA_LOCATIONS.length))} curated giant-panda places are waiting on the globe. Sanctuary and reserve points now read in purple so they stand out from zoos.</p>`,
      "</header>",
      '<section class="panda-card">',
      '  <div class="panda-header">',
      '    <div class="panda-kind">giant pandas only</div>',
      '    <div class="panda-name">Choose a panda point</div>',
      "  </div>",
      `  <div class="panda-meta">${kinds.map(function (kind) { return `<span class="panda-meta-row">${escapeHtml(kind)}</span>`; }).join("")}</div>`,
      '  <div class="legend-row">',
      '    <span class="legend-pill"><span class="legend-dot"></span> zoo</span>',
      '    <span class="legend-pill"><span class="legend-dot is-breeding"></span> breeding center</span>',
      '    <span class="legend-pill"><span class="legend-dot is-reserve"></span> reserve or sanctuary</span>',
      "  </div>",
      '  <p class="panda-summary">This layer stays curated instead of pretending to be live GPS. Click a panda point to open the institution, habitat notes, and official links.</p>',
      "</section>"
    ].join(""));
  }

  function renderPandaLocation(location) {
    const actions = [
      location.camUrl
        ? `<a class="panel-action panel-action--primary" href="${escapeAttribute(location.camUrl)}" target="_blank" rel="noreferrer">Watch cam</a>`
        : "",
      `<a class="panel-action" href="${escapeAttribute(location.officialUrl)}" target="_blank" rel="noreferrer">Official site</a>`
    ].join("");

    setPanelContent([
      '<header class="panel-header">',
      `  <h1 class="place-name">${escapeHtml(location.name)}</h1>`,
      `  <p class="coords-line">${escapeHtml(location.region)}, ${escapeHtml(location.country)}</p>`,
      "</header>",
      '<section class="panda-card">',
      '  <div class="panda-header">',
      `    <div class="panda-kind">${escapeHtml(location.kind)}</div>`,
      `    <div class="panda-name">${escapeHtml(location.name)}</div>`,
      "  </div>",
      `  <div class="panda-meta"><span class="panda-meta-row">${escapeHtml(location.region)}</span><span class="panda-meta-row">${escapeHtml(location.country)}</span></div>`,
      `  <p class="panda-summary">${escapeHtml(location.summary)}</p>`,
      '  <div class="panda-notes">',
      `    <div class="panda-note"><strong>Pandas:</strong> ${escapeHtml(location.pandas || "Current resident details vary by season.")}</div>`,
      '    <div class="panda-note">Cam links open on their official host pages instead of being embedded here.</div>',
      "  </div>",
      `  <div class="panda-actions">${actions}</div>`,
      "</section>"
    ].join(""));
  }

  function renderNudibranchOverviewState() {
    setPanelContent([
      '<header class="panel-header">',
      '  <h1 class="place-name">Nudibranchs</h1>',
      '  <p class="coords-line">Purple sea-slug population points are grouped by region. Click one and every overlapping population in that region will open on the left.</p>',
      "</header>",
      '<section class="biome-card">',
      '  <div class="biome-title-row"><div class="biome-title">Population hotspots</div></div>',
      '  <div class="tag-row"><span class="tag">reef</span><span class="tag">kelp</span><span class="tag">open drift</span></div>',
      '  <p class="biome-description">This layer is a curated habitat map, not a claim that every nudibranch stays in one neat border. Each point represents a region where specific species show up reliably enough to make a meaningful stop on the globe.</p>',
      "</section>"
    ].join(""));
  }

  function renderNudibranchRegionPanel(region) {
    setPanelContent([
      '<header class="panel-header">',
      `  <h1 class="place-name">${escapeHtml(region.name)}</h1>`,
      `  <p class="coords-line">${escapeHtml(region.waters)}</p>`,
      "</header>",
      '<section class="biome-card">',
      '  <div class="biome-title-row"><div class="biome-title">Region feel</div></div>',
      `  <div class="tag-row"><span class="tag">nudibranch cluster</span><span class="tag">${escapeHtml(String(region.species.length))} species</span></div>`,
      `  <p class="biome-description">${escapeHtml(region.summary)}</p>`,
      "</section>",
      '<section class="animals-section">',
      '  <div class="section-label">species list</div>',
      '  <div class="placeholder-card placeholder-card--wide">',
      '    <div class="empty-state">The overlapping species cards for this region open in the left tray so you can compare them without losing the globe.</div>',
      "  </div>",
      "</section>"
    ].join(""));
  }

  function renderNudibranchSpeciesList(region, cards, loading) {
    const body = [
      '<div class="left-header">',
      '  <div class="left-eyebrow">Nudibranch populations</div>',
      `  <h2 class="left-title">${escapeHtml(region.name)}</h2>`,
      `  <p class="left-copy">${escapeHtml(region.waters)}. Every card below belongs to this hotspot, so overlapping populations stay readable instead of fighting each other on the globe.</p>`,
      "</div>",
      '<div class="nudibranch-list">',
      loading
        ? renderNudibranchSkeletonCard() + renderNudibranchSkeletonCard()
        : cards.length
          ? cards.map(renderNudibranchCardHtml).join("")
          : '<article class="placeholder-card placeholder-card--wide"><div class="empty-state">Representative photos are not loading right now, but this region still maps a real nudibranch hotspot.</div></article>',
      "</div>"
    ].join("");

    openLeftDetail(body);
  }

  function renderRadarOverviewState() {
    setPanelContent([
      '<header class="panel-header">',
      '  <h1 class="place-name">Weather Radar</h1>',
      '  <p class="coords-line">Click a location and the panel will pull the newest available radar frame centered on that spot.</p>',
      "</header>",
      '<section class="panda-card">',
      '  <div class="panda-header">',
      '    <div class="panda-kind">RainViewer frame</div>',
      '    <div class="panda-name">Recent radar snapshot</div>',
      "  </div>",
      '  <p class="panda-summary">Radar is strongest where land-based radar networks exist, so open ocean clicks may look sparse even when the weather is active.</p>',
      "</section>"
    ].join(""));
  }

  function renderRadarLoadingState(lat, lng) {
    setPanelContent([
      '<header class="panel-header">',
      '  <h1 class="place-name">loading radar...</h1>',
      `  <p class="coords-line">${formatCoordsHtml(lat, lng)}</p>`,
      "</header>",
      '<section class="radar-card placeholder-card--shimmer">',
      '  <div class="radar-image"></div>',
      '  <div class="radar-copy">',
      '    <div class="placeholder-line"></div>',
      '    <div class="placeholder-line short"></div>',
      "  </div>",
      "</section>"
    ].join(""));
  }

  function renderRadarResolvedState(payload) {
    const imageMarkup = payload.radar.imageUrl
      ? `<img class="radar-image" src="${escapeAttribute(payload.radar.imageUrl)}" alt="Radar snapshot for ${escapeAttribute(payload.place.title)}" loading="lazy" width="512" height="512">`
      : '<div class="radar-image"></div>';

    setPanelContent([
      '<header class="panel-header">',
      `  <h1 class="place-name">${escapeHtml(payload.place.title)}</h1>`,
      `  <p class="coords-line">${formatCoordsHtml(payload.coords.lat, payload.coords.lng)}</p>`,
      "</header>",
      '<section class="radar-card">',
      `  ${imageMarkup}`,
      '  <div class="radar-copy">',
      `    <div class="panda-kind">${escapeHtml(payload.radar.capturedAt || "latest available frame")}</div>`,
      `    <p class="panda-summary">${escapeHtml(payload.radar.note)}</p>`,
      payload.radar.link ? `    <a class="panel-action" href="${escapeAttribute(payload.radar.link)}" target="_blank" rel="noreferrer">Open source</a>` : "",
      "  </div>",
      "</section>"
    ].join(""));
  }

  function renderHistoryOverviewState() {
    setPanelContent([
      '<header class="panel-header">',
      '  <h1 class="place-name">Weather History</h1>',
      '  <p class="coords-line">Click a location to pull the last seven completed days of temperature, precipitation, and wind.</p>',
      "</header>",
      '<section class="panda-card">',
      '  <div class="panda-header">',
      '    <div class="panda-kind">Open-Meteo archive</div>',
      '    <div class="panda-name">Seven-day weather memory</div>',
      "  </div>",
      '  <p class="panda-summary">This mode stays lightweight: it only fetches archive data when you are in Weather History, and it never runs at the same time as the radar or wildlife layers.</p>',
      "</section>"
    ].join(""));
  }

  function renderHistoryLoadingState(lat, lng) {
    setPanelContent([
      '<header class="panel-header">',
      '  <h1 class="place-name">loading history...</h1>',
      `  <p class="coords-line">${formatCoordsHtml(lat, lng)}</p>`,
      "</header>",
      '<section class="weather-grid">',
      renderWeatherDaySkeleton() + renderWeatherDaySkeleton() + renderWeatherDaySkeleton(),
      "</section>"
    ].join(""));
  }

  function renderHistoryResolvedState(payload) {
    setPanelContent([
      '<header class="panel-header">',
      `  <h1 class="place-name">${escapeHtml(payload.place.title)}</h1>`,
      `  <p class="coords-line">${formatCoordsHtml(payload.coords.lat, payload.coords.lng)}</p>`,
      "</header>",
      '<section class="weather-grid">',
      payload.history.days.length
        ? payload.history.days.map(renderWeatherDayHtml).join("")
        : '<article class="placeholder-card placeholder-card--wide"><div class="empty-state">History is not available for this point right now.</div></article>',
      "</section>"
    ].join(""));
  }

  function renderBiomeHtml(biome) {
    const tags = [biome.landscape, biome.soil]
      .map(function (tag) { return `<span class="tag">${escapeHtml(tag)}</span>`; })
      .join("");

    return [
      '<section class="biome-card">',
      '  <div class="biome-title-row">',
      `    <div class="biome-title">${escapeHtml(biome.biome)}</div>`,
      "  </div>",
      `  <div class="tag-row">${tags}</div>`,
      `  <p class="biome-description">${escapeHtml(biome.description)}</p>`,
      "</section>"
    ].join("");
  }

  function renderClimateHtml(climate) {
    if (!climate || !climate.available) {
      return [
        renderClimatePlaceholderHtml("temp unavailable"),
        renderClimatePlaceholderHtml("precip unavailable"),
        renderClimatePlaceholderHtml("wind unavailable")
      ].join("");
    }

    return [
      renderClimateChipHtml("temp", climate.temperatureText || "unavailable", !climate.temperatureText),
      renderClimateChipHtml("precip", climate.precipitationText || "unavailable", !climate.precipitationText),
      renderClimateChipHtml("wind", climate.windText || "unavailable", !climate.windText)
    ].join("");
  }

  function renderClimateChipHtml(label, value, placeholder) {
    if (placeholder) {
      return renderClimatePlaceholderHtml(`${label} unavailable`);
    }

    return [
      '<div class="climate-chip">',
      '  <div class="climate-chip-top">',
      `    <span class="climate-label">${escapeHtml(label)}</span>`,
      "  </div>",
      `  <div class="climate-value">${escapeHtml(value)}</div>`,
      "</div>"
    ].join("");
  }

  function renderClimatePlaceholderHtml(label) {
    return `<div class="climate-chip climate-chip-placeholder">${escapeHtml(label)}</div>`;
  }

  function renderAnimalsHtml(animals) {
    if (animals && animals.loading) {
      return renderSkeletonCardHtml() + renderSkeletonCardHtml() + renderSkeletonCardHtml();
    }

    if (!animals || !animals.available) {
      return [
        '<article class="placeholder-card placeholder-card--wide">',
        '  <div class="placeholder-line"></div>',
        '  <div class="empty-state">Records are hazy right now, but the biome card still keeps the place alive.</div>',
        "</article>"
      ].join("");
    }

    if (animals.emptyMessage) {
      return [
        '<article class="placeholder-card placeholder-card--wide">',
        `  <div class="empty-state muted-italic">${escapeHtml(animals.emptyMessage)}</div>`,
        "</article>"
      ].join("");
    }

    return animals.items.map(renderAnimalCardHtml).join("");
  }

  function renderSkeletonCardHtml() {
    return [
      '<article class="animal-card animal-card-placeholder">',
      '  <div class="animal-image animal-image-placeholder"></div>',
      '  <div class="animal-copy">',
      '    <div class="placeholder-line"></div>',
      '    <div class="placeholder-line short"></div>',
      "  </div>",
      "</article>"
    ].join("");
  }

  function renderAnimalCardHtml(item) {
    const imageMarkup = item.photoUrl
      ? `<img class="animal-image" src="${escapeAttribute(item.photoUrl)}" alt="${escapeAttribute(item.commonName || item.scientificName || "wildlife observation")}" loading="lazy" width="220" height="220">`
      : '<div class="animal-image animal-image-placeholder"></div>';
    const commonNameMarkup = item.commonName
      ? `<p class="animal-name">${escapeHtml(item.commonName)}</p>`
      : '<div class="placeholder-line"></div>';
    const scientificNameMarkup = item.scientificName
      ? `<p class="animal-sci">${escapeHtml(item.scientificName)}</p>`
      : '<div class="placeholder-line short"></div>';

    return [
      '<article class="animal-card">',
      `  ${imageMarkup}`,
      '  <div class="animal-copy">',
      `    ${commonNameMarkup}`,
      `    ${scientificNameMarkup}`,
      "  </div>",
      "</article>"
    ].join("");
  }

  function renderNudibranchCardHtml(card) {
    const imageMarkup = card.photoUrl
      ? `<img class="nudibranch-species-image" src="${escapeAttribute(card.photoUrl)}" alt="${escapeAttribute(card.commonName || card.scientificName)}" loading="lazy" width="420" height="340">`
      : '<div class="nudibranch-species-image"></div>';

    return [
      '<article class="nudibranch-species-card">',
      `  ${imageMarkup}`,
      '  <div class="nudibranch-species-copy">',
      `    <p class="nudibranch-species-name">${escapeHtml(card.commonName || card.scientificName)}</p>`,
      `    <p class="nudibranch-species-sci">${escapeHtml(card.scientificName)}</p>`,
      `    <p class="nudibranch-species-note">${escapeHtml(card.note)}</p>`,
      "  </div>",
      "</article>"
    ].join("");
  }

  function renderNudibranchSkeletonCard() {
    return [
      '<article class="nudibranch-species-card placeholder-card--shimmer">',
      '  <div class="nudibranch-species-image"></div>',
      '  <div class="nudibranch-species-copy">',
      '    <div class="placeholder-line"></div>',
      '    <div class="placeholder-line short"></div>',
      '    <div class="placeholder-line"></div>',
      "  </div>",
      "</article>"
    ].join("");
  }

  function renderWeatherDayHtml(day) {
    return [
      '<article class="weather-day-card">',
      `  <div class="weather-day-date">${escapeHtml(day.label)}</div>`,
      '  <div class="weather-day-copy">',
      '    <div class="weather-day-values">',
      `      <div><strong>${escapeHtml(day.temp)}</strong>temp range</div>`,
      `      <div><strong>${escapeHtml(day.precip)}</strong>precip</div>`,
      `      <div><strong>${escapeHtml(day.wind)}</strong>wind</div>`,
      "    </div>",
      "  </div>",
      "</article>"
    ].join("");
  }

  function renderWeatherDaySkeleton() {
    return [
      '<article class="weather-day-card placeholder-card--shimmer">',
      '  <div class="weather-day-date">...</div>',
      '  <div class="weather-day-copy">',
      '    <div class="placeholder-line"></div>',
      '    <div class="placeholder-line short"></div>',
      "  </div>",
      "</article>"
    ].join("");
  }

  function getGlobePayload(lat, lng, biome) {
    const key = getCacheKey(lat, lng);
    const cached = GLOBE_CACHE.get(key);

    if (cached && cached.data) {
      return Promise.resolve(rehydrateCoords(cached.data, lat, lng));
    }

    if (cached && cached.promise) {
      return cached.promise.then(function (payload) {
        return rehydrateCoords(payload, lat, lng);
      });
    }

    const promise = Promise.allSettled([
      fetchPlace(lat, lng, biome),
      fetchClimate(lat, lng),
      fetchAnimals(lat, lng)
    ]).then(function (results) {
      const payload = normalizeGlobePayload(lat, lng, biome, results);
      GLOBE_CACHE.set(key, { data: payload });
      return payload;
    });

    GLOBE_CACHE.set(key, { promise: promise });
    return promise;
  }

  function getRadarPayload(lat, lng) {
    const key = getCacheKey(lat, lng);
    const cached = RADAR_CACHE.get(key);
    const biome = getBiome(lat, lng);

    if (cached && cached.data) {
      return Promise.resolve(rehydrateCoords(cached.data, lat, lng));
    }

    if (cached && cached.promise) {
      return cached.promise.then(function (payload) {
        return rehydrateCoords(payload, lat, lng);
      });
    }

    const promise = Promise.allSettled([
      fetchPlace(lat, lng, biome),
      fetchRadarSnapshot(lat, lng)
    ]).then(function (results) {
      const resolvedPlace = results[0].status === "fulfilled" ? results[0].value : createFallbackPlace(biome);
      const place = resolveContextPlace(lat, lng, biome, resolvedPlace).place;
      const radar = results[1].status === "fulfilled" ? results[1].value : {
        imageUrl: "",
        capturedAt: "",
        note: "Radar imagery is not available for this spot right now.",
        link: "https://www.rainviewer.com/"
      };

      const payload = {
        coords: { lat: lat, lng: lng },
        place: place,
        radar: radar
      };

      RADAR_CACHE.set(key, { data: payload });
      return payload;
    });

    RADAR_CACHE.set(key, { promise: promise });
    return promise;
  }

  function getHistoryPayload(lat, lng) {
    const key = getCacheKey(lat, lng);
    const cached = HISTORY_CACHE.get(key);
    const biome = getBiome(lat, lng);

    if (cached && cached.data) {
      return Promise.resolve(rehydrateCoords(cached.data, lat, lng));
    }

    if (cached && cached.promise) {
      return cached.promise.then(function (payload) {
        return rehydrateCoords(payload, lat, lng);
      });
    }

    const promise = Promise.allSettled([
      fetchPlace(lat, lng, biome),
      fetchWeatherHistory(lat, lng)
    ]).then(function (results) {
      const resolvedPlace = results[0].status === "fulfilled" ? results[0].value : createFallbackPlace(biome);
      const payload = {
        coords: { lat: lat, lng: lng },
        place: resolveContextPlace(lat, lng, biome, resolvedPlace).place,
        history: results[1].status === "fulfilled"
          ? results[1].value
          : { days: [] }
      };

      HISTORY_CACHE.set(key, { data: payload });
      return payload;
    });

    HISTORY_CACHE.set(key, { promise: promise });
    return promise;
  }

  function getNudibranchRegionCards(region) {
    const cacheKey = `region:${region.id}`;
    if (PHOTO_CACHE.has(cacheKey)) {
      return PHOTO_CACHE.get(cacheKey);
    }

    const promise = Promise.all(region.species.map(function (species) {
      return fetchSpeciesPhoto(species.scientificName).then(function (photoUrl) {
        return {
          commonName: species.commonName,
          scientificName: species.scientificName,
          note: species.note,
          photoUrl: photoUrl
        };
      });
    }));

    PHOTO_CACHE.set(cacheKey, promise);
    return promise;
  }

  function rehydrateCoords(payload, lat, lng) {
    return Object.assign({}, payload, {
      coords: { lat: lat, lng: lng }
    });
  }

  function normalizeGlobePayload(lat, lng, biome, results) {
    const place = results[0].status === "fulfilled" ? results[0].value : createFallbackPlace(biome);
    const climate = results[1].status === "fulfilled"
      ? results[1].value
      : { available: false, temperatureText: "", precipitationText: "", windText: "" };
    const animals = results[2].status === "fulfilled"
      ? results[2].value
      : { available: false, items: [], emptyMessage: "" };
    const placeContext = resolveContextPlace(lat, lng, biome, place);
    const finalPlace = placeContext.place;
    const finalBiome = placeContext.biome;
    const filteredAnimals = filterAnimalsForContext(animals, finalBiome, finalPlace);

    return {
      coords: { lat: lat, lng: lng },
      biome: finalBiome,
      sourceMode: state.textureMode,
      place: finalPlace,
      climate: climate,
      animals: filteredAnimals
    };
  }

  function createFallbackGlobePayload(lat, lng, biome) {
    return {
      coords: { lat: lat, lng: lng },
      biome: biome,
      sourceMode: state.textureMode,
      place: createFallbackPlace(biome),
      climate: { available: false, temperatureText: "", precipitationText: "", windText: "" },
      animals: { available: false, items: [], emptyMessage: "" }
    };
  }

  function createFallbackRadarPayload(lat, lng) {
    return {
      coords: { lat: lat, lng: lng },
      place: createFallbackPlace(BIOME_PRESETS["open ocean"]),
      radar: {
        imageUrl: "",
        capturedAt: "",
        note: "Radar imagery is not available for this spot right now.",
        link: "https://www.rainviewer.com/"
      }
    };
  }

  function createFallbackHistoryPayload(lat, lng) {
    return {
      coords: { lat: lat, lng: lng },
      place: createFallbackPlace(BIOME_PRESETS["open ocean"]),
      history: { days: [] }
    };
  }

  async function fetchPlace(lat, lng, biome) {
    const url = new URL("https://nominatim.openstreetmap.org/reverse");
    url.search = new URLSearchParams({
      lat: lat.toFixed(4),
      lon: lng.toFixed(4),
      format: "json"
    }).toString();

    const data = await fetchJson(url.toString());
    const address = data.address || {};
    const displayName = typeof data.display_name === "string" ? data.display_name : "";
    const locality = address.city || address.town || address.village || address.municipality || address.county || address.state_district || address.state;
    const country = address.country || "";
    const featureCategory = `${data.category || ""} ${data.type || ""}`.trim();
    const waterHint = hasWaterHint(displayName, address, featureCategory);
    const coastalHint = hasCoastalHint(displayName, address, featureCategory);

    return {
      title: buildPlaceTitle(locality, country, displayName, biome, waterHint),
      displayName: displayName,
      locality: locality || "",
      country: country,
      waterHint: waterHint,
      coastalHint: coastalHint,
      featureCategory: featureCategory
    };
  }

  async function fetchClimate(lat, lng) {
    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.search = new URLSearchParams({
      latitude: lat.toFixed(4),
      longitude: lng.toFixed(4),
      current_weather: "true",
      daily: "precipitation_sum,temperature_2m_max,temperature_2m_min",
      forecast_days: "1",
      timezone: "auto"
    }).toString();

    const data = await fetchJson(url.toString());
    const current = data.current_weather || {};
    const daily = data.daily || {};
    const tempMin = getArrayValue(daily.temperature_2m_min, 0);
    const tempMax = getArrayValue(daily.temperature_2m_max, 0);
    const precipitation = getArrayValue(daily.precipitation_sum, 0);

    return {
      available: true,
      temperatureText: Number.isFinite(tempMin) && Number.isFinite(tempMax)
        ? `${Math.round(tempMin)}-${Math.round(tempMax)} deg C`
        : Number.isFinite(current.temperature)
          ? `${Math.round(current.temperature)} deg C`
          : "",
      precipitationText: Number.isFinite(precipitation) ? `${precipitation.toFixed(1)} mm` : "",
      windText: Number.isFinite(current.windspeed) ? `${Math.round(current.windspeed)} km/h` : ""
    };
  }

  async function fetchAnimals(lat, lng) {
    const url = new URL("https://api.inaturalist.org/v1/observations");
    url.search = new URLSearchParams({
      lat: lat.toFixed(4),
      lng: lng.toFixed(4),
      radius: "90",
      per_page: "12",
      order_by: "votes",
      photos: "true",
      quality_grade: "research"
    }).toString();

    const data = await fetchJson(url.toString());
    const observations = Array.isArray(data.results) ? data.results : [];

    if (!observations.length) {
      return {
        available: true,
        items: [],
        emptyMessage: "no recorded sightings here - the wild unknown"
      };
    }

    const sorted = observations
      .map(normalizeObservation)
      .sort(function (left, right) {
        return right.score - left.score;
      });
    const featuredIndex = sorted.findIndex(function (item) {
      return item.featured;
    });

    if (featuredIndex > 0) {
      sorted.unshift(sorted.splice(featuredIndex, 1)[0]);
    }

    return {
      available: true,
      items: sorted.slice(0, 6),
      emptyMessage: ""
    };
  }

  async function fetchRadarSnapshot(lat, lng) {
    const data = await fetchJson(RADAR_SOURCE_URL);
    const host = typeof data.host === "string" ? data.host : "https://tilecache.rainviewer.com";
    const radar = data.radar || {};
    const frames = Array.isArray(radar.past) && radar.past.length
      ? radar.past
      : Array.isArray(radar.nowcast) && radar.nowcast.length
        ? radar.nowcast
        : [];

    if (!frames.length) {
      throw new Error("No radar frames available");
    }

    const frame = frames[frames.length - 1];
    const path = frame.path || "";
    const timestamp = frame.time ? new Date(frame.time * 1000) : null;

    return {
      imageUrl: `${host}${path}/512/6/${lat.toFixed(4)}/${lng.toFixed(4)}/2/1_1.png`,
      capturedAt: timestamp ? formatRadarTime(timestamp) : "latest available frame",
      note: "This is the newest available radar-centered frame for the selected point. Open-water coverage can look sparse because radar depends on land networks.",
      link: "https://www.rainviewer.com/"
    };
  }

  async function fetchWeatherHistory(lat, lng) {
    const end = new Date();
    end.setDate(end.getDate() - 1);
    const start = new Date(end.getTime());
    start.setDate(start.getDate() - 6);

    const url = new URL("https://archive-api.open-meteo.com/v1/archive");
    url.search = new URLSearchParams({
      latitude: lat.toFixed(4),
      longitude: lng.toFixed(4),
      start_date: formatApiDate(start),
      end_date: formatApiDate(end),
      daily: "temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max",
      timezone: "auto"
    }).toString();

    const data = await fetchJson(url.toString());
    const daily = data.daily || {};
    const dates = Array.isArray(daily.time) ? daily.time : [];

    return {
      days: dates.map(function (date, index) {
        const tempMax = getArrayValue(daily.temperature_2m_max, index);
        const tempMin = getArrayValue(daily.temperature_2m_min, index);
        const precip = getArrayValue(daily.precipitation_sum, index);
        const wind = getArrayValue(daily.wind_speed_10m_max, index);

        return {
          label: formatHistoryLabel(date),
          temp: Number.isFinite(tempMin) && Number.isFinite(tempMax)
            ? `${Math.round(tempMin)}-${Math.round(tempMax)} deg C`
            : "n/a",
          precip: Number.isFinite(precip) ? `${precip.toFixed(1)} mm` : "n/a",
          wind: Number.isFinite(wind) ? `${Math.round(wind)} km/h` : "n/a"
        };
      })
    };
  }

  async function fetchSpeciesPhoto(scientificName) {
    const cacheKey = `species:${scientificName}`;
    if (PHOTO_CACHE.has(cacheKey)) {
      return PHOTO_CACHE.get(cacheKey);
    }

    const promise = (async function () {
      const url = new URL("https://api.inaturalist.org/v1/observations");
      url.search = new URLSearchParams({
        taxon_name: scientificName,
        per_page: "1",
        order_by: "votes",
        quality_grade: "research",
        photos: "true"
      }).toString();

      const data = await fetchJson(url.toString());
      const observation = Array.isArray(data.results) ? data.results[0] : null;
      const firstPhoto = observation && Array.isArray(observation.photos) ? observation.photos[0] : null;
      if (firstPhoto && typeof firstPhoto.url === "string") {
        return firstPhoto.url.replace("square", "medium");
      }
      return "";
    })();

    PHOTO_CACHE.set(cacheKey, promise);
    return promise;
  }

  function normalizeObservation(observation) {
    const taxon = observation.taxon || {};
    const scientificName = taxon.name || "";
    const commonName = taxon.preferred_common_name || observation.species_guess || "";
    const iconicTaxon = (taxon.iconic_taxon_name || "").toLowerCase();
    const lowerName = `${scientificName} ${commonName}`.toLowerCase();
    const featured = lowerName.indexOf("nudibranch") !== -1 || iconicTaxon === "mollusca";
    const photos = Array.isArray(observation.photos) ? observation.photos : [];
    const firstPhoto = photos[0] || {};
    const photoUrl = typeof firstPhoto.url === "string" ? firstPhoto.url.replace("square", "medium") : "";
    const observationsCount = taxon.observations_count;
    const score =
      (observation.quality_grade === "research" ? 1 : 0) * 0.3 +
      (observationsCount ? (1 / Math.log(observationsCount + 2)) : 0) * 0.4 +
      ((observation.faves_count || 0) / 10) * 0.3;

    return {
      commonName: commonName,
      scientificName: scientificName,
      photoUrl: photoUrl,
      featured: featured,
      score: score,
      iconicTaxon: iconicTaxon,
      lowerName: lowerName
    };
  }

  function resolveContextPlace(lat, lng, biome, place) {
    let finalPlace = place;
    let finalBiome = resolveBiomeForPlace(biome, place);

    if (place.title === "Unmapped Ground") {
      finalBiome = resolveFallbackWaterBiome(lat, lng, finalBiome);

      if (isWaterBiome(finalBiome)) {
        finalPlace = Object.assign({}, place, {
          title: buildPlaceTitle(place.locality, place.country, place.displayName, finalBiome, true),
          waterHint: true,
          coastalHint: finalBiome.biome === "coastal/reef"
        });
      }
    }

    return {
      place: finalPlace,
      biome: finalBiome
    };
  }

  function isWaterBiome(biome) {
    return Boolean(biome) && (biome.biome === "open ocean" || biome.biome === "coastal/reef");
  }

  function resolveBiomeForPlace(biome, place) {
    if (!place || !place.waterHint) {
      return biome;
    }

    if (place.coastalHint || /reef|bay|channel|strait|sound|coast|shoal|bank|keys|archipelago/i.test(place.displayName)) {
      return BIOME_PRESETS["coastal/reef"] || biome;
    }

    return BIOME_PRESETS["open ocean"] || biome;
  }

  function resolveFallbackWaterBiome(lat, lng, biome) {
    const absLat = Math.abs(lat);
    const tropicalOcean =
      absLat < 30 &&
      (
        (lng > 20 && lng < 120) ||
        (lng > 120 || lng < -75) ||
        (lng > -75 && lng < 20)
      );
    const temperateAtlantic = absLat >= 30 && absLat < 62 && lng > -70 && lng < 20;
    const temperatePacific = absLat >= 30 && absLat < 62 && (lng > 125 || lng < -115);
    const southernOcean = absLat >= 50 && absLat < 72;

    if (tropicalOcean || temperateAtlantic || temperatePacific || southernOcean) {
      return BIOME_PRESETS["open ocean"] || biome;
    }

    return biome;
  }

  function filterAnimalsForContext(animals, biome, place) {
    if (!animals || !animals.available || !animals.items.length) {
      return animals;
    }

    const waterContext = (place && place.waterHint) || biome.biome === "open ocean" || biome.biome === "coastal/reef";
    if (!waterContext) {
      return animals;
    }

    const filteredItems = animals.items.filter(isMarineObservation);
    if (filteredItems.length) {
      return {
        available: true,
        items: filteredItems,
        emptyMessage: ""
      };
    }

    return {
      available: true,
      items: [],
      emptyMessage: "no recorded sightings here - the wild unknown"
    };
  }

  function isMarineObservation(item) {
    const keywords = [
      "whale", "dolphin", "porpoise", "seal", "sea lion", "manatee", "dugong",
      "turtle", "gull", "tern", "albatross", "frigate", "pelican", "booby",
      "shearwater", "petrel", "cormorant", "puffin", "auk", "penguin",
      "ray", "shark", "eel", "seahorse", "jelly", "coral", "anemone",
      "urchin", "sea star", "starfish", "octopus", "squid", "nudibranch",
      "sea slug", "slug", "mollusc", "mollusk", "fish", "crab", "shrimp", "lobster"
    ];
    const matchesKeyword = keywords.some(function (keyword) {
      return item.lowerName.indexOf(keyword) !== -1;
    });

    return matchesKeyword || item.iconicTaxon === "mollusca" || item.iconicTaxon === "actinopterygii";
  }

  function createFallbackPlace(biome) {
    if (biome && (biome.biome === "open ocean" || biome.biome === "coastal/reef")) {
      return {
        title: "Remote Waters",
        displayName: "",
        locality: "",
        country: "",
        waterHint: true,
        coastalHint: biome.biome === "coastal/reef"
      };
    }

    return {
      title: "Unmapped Ground",
      displayName: "",
      locality: "",
      country: "",
      waterHint: false,
      coastalHint: false
    };
  }

  function buildPlaceTitle(locality, country, displayName, biome, waterHint) {
    if (waterHint) {
      if (/atlantic/i.test(displayName)) return "Atlantic Waters";
      if (/pacific/i.test(displayName)) return "Pacific Waters";
      if (/indian ocean/i.test(displayName)) return "Indian Ocean Waters";
      if (/caribbean/i.test(displayName)) return "Caribbean Waters";
      if (/mediterranean/i.test(displayName)) return "Mediterranean Waters";
      if (/red sea/i.test(displayName)) return "Red Sea Waters";
      return "Remote Waters";
    }

    if (locality && country) {
      return `${locality}, ${country}`;
    }

    return shortenDisplayName(displayName) || createFallbackPlace(biome).title;
  }

  function hasWaterHint(displayName, address, featureCategory) {
    const joinedAddress = Object.keys(address || {}).map(function (key) {
      return `${key} ${address[key]}`;
    }).join(" ");
    return /ocean|sea|gulf|bay|strait|channel|sound|bight|reef|shoal|bank|waters|water/i.test(displayName + " " + joinedAddress + " " + featureCategory);
  }

  function hasCoastalHint(displayName, address, featureCategory) {
    const joinedAddress = Object.keys(address || {}).map(function (key) {
      return `${key} ${address[key]}`;
    }).join(" ");
    return /bay|reef|shoal|bank|coast|beach|island|sound|channel|keys|archipelago|coastline/i.test(displayName + " " + joinedAddress + " " + featureCategory);
  }

  function shortenDisplayName(displayName) {
    if (typeof displayName !== "string" || !displayName.trim()) {
      return "";
    }

    const segments = displayName.split(",").map(function (segment) {
      return segment.trim();
    }).filter(Boolean);

    if (segments.length >= 2) {
      return `${segments[0]}, ${segments[segments.length - 1]}`;
    }

    return segments[0] || "";
  }

  function renderCountdown(remainingMs, includeDays) {
    const totalSeconds = Math.floor(remainingMs / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const segments = [];

    if (includeDays) {
      segments.push(renderCountdownSegment(days, "d"));
    }

    segments.push(renderCountdownSegment(hours, "h"));
    segments.push(renderCountdownSegment(minutes, "m"));
    segments.push(renderCountdownSegment(seconds, "s"));

    elements.countdownTime.innerHTML = segments.join("");
  }

  function renderCountdownSegment(value, unit) {
    return `<span class="countdown-segment"><span class="countdown-value">${pad(value)}</span><span class="countdown-unit">${unit}</span></span>`;
  }

  function populateNudibranchs(targetField, options) {
    if (!targetField) {
      return;
    }

    const settings = Object.assign({
      min: 4,
      max: 8
    }, options);
    const shapes = getNudibranchSvgs();
    const placementPool = shuffle([
      { top: "5vh", left: "4vw", size: "212px", rotation: "-14deg" },
      { top: "7vh", left: "18vw", size: "176px", rotation: "11deg" },
      { top: "8vh", right: "6vw", size: "190px", rotation: "16deg" },
      { top: "28vh", left: "1vw", size: "182px", rotation: "-21deg" },
      { top: "30vh", right: "1vw", size: "186px", rotation: "18deg" },
      { bottom: "24vh", left: "3vw", size: "172px", rotation: "13deg" },
      { bottom: "21vh", right: "4vw", size: "178px", rotation: "-16deg" },
      { bottom: "7vh", left: "5vw", size: "220px", rotation: "9deg" },
      { bottom: "6vh", right: "7vw", size: "206px", rotation: "-19deg" }
    ]);
    const spread = Math.max(1, settings.max - settings.min + 1);
    const count = settings.min + Math.floor(Math.random() * spread);
    const placements = placementPool.slice(0, count);

    targetField.innerHTML = placements.map(function (placement, index) {
      const shape = shapes[Math.floor(Math.random() * shapes.length)];
      const scale = (0.9 + Math.random() * 0.18).toFixed(2);
      const flip = Math.random() > 0.5 ? -1 : 1;
      const opacity = (0.38 + Math.random() * 0.18).toFixed(2);
      const stroke = (2.1 + Math.random() * 0.9).toFixed(2);
      const duration = (6.4 + Math.random() * 3.2).toFixed(2);
      const delay = ((index * 0.85) + Math.random() * 1.1).toFixed(2);
      const styleParts = [
        `--size:${placement.size}`,
        `--stroke:${stroke}`,
        `--nudibranch-transform: rotate(${placement.rotation}) scale(${scale}) scaleX(${flip})`,
        `--nudibranch-opacity:${opacity}`,
        `--nudibranch-duration:${duration}s`,
        `--nudibranch-delay:-${delay}s`
      ];

      if (placement.top) styleParts.push(`top:${placement.top}`);
      if (placement.bottom) styleParts.push(`bottom:${placement.bottom}`);
      if (placement.left) styleParts.push(`left:${placement.left}`);
      if (placement.right) styleParts.push(`right:${placement.right}`);

      return `<div class="nudibranch" style="${styleParts.join(";")}">${shape}</div>`;
    }).join("");
  }

  function getNudibranchSvgs() {
    return [
      '<svg viewBox="0 0 240 160" role="img" aria-label="nudibranch illustration"><path d="M18 104 C34 76, 58 61, 86 54 C115 46, 138 50, 163 38 C163 53, 172 66, 194 75 C181 84, 175 101, 181 120 C157 113, 137 118, 116 133 C92 124, 68 122, 40 129 C47 116, 40 109, 18 104" /><path d="M71 61 C79 39, 77 24, 68 11" /><path d="M101 54 C111 34, 114 18, 111 6" /><path d="M145 45 C157 31, 166 18, 179 8" /><path d="M39 105 C57 95, 77 91, 100 94 C123 97, 141 108, 162 111" /><path d="M58 118 C74 110, 92 110, 112 117" /></svg>',
      '<svg viewBox="0 0 240 160" role="img" aria-label="nudibranch illustration"><path d="M26 98 C43 78, 63 67, 88 60 C111 53, 137 48, 160 38 C160 54, 170 69, 188 81 C181 92, 180 109, 187 124 C161 118, 141 123, 115 138 C89 128, 66 126, 42 132 C46 118, 39 109, 26 98" /><path d="M54 89 C77 84, 96 87, 117 94 C137 101, 154 104, 174 102" /><path d="M93 61 C98 37, 94 23, 84 9" /><path d="M124 52 C137 30, 145 18, 158 8" /><path d="M151 40 C168 37, 186 28, 207 11" /><path d="M74 124 C88 118, 104 118, 122 122" /></svg>',
      '<svg viewBox="0 0 240 160" role="img" aria-label="nudibranch illustration"><path d="M21 102 C33 81, 52 66, 79 57 C104 49, 128 48, 150 39 C154 54, 168 67, 191 74 C180 87, 175 102, 179 120 C157 114, 138 118, 119 133 C93 124, 70 122, 43 129 C47 116, 39 108, 21 102" /><path d="M42 98 C61 91, 82 90, 106 95 C128 99, 145 110, 167 111" /><path d="M79 60 C82 38, 79 25, 69 10" /><path d="M111 50 C119 31, 128 17, 143 6" /><path d="M166 73 C186 70, 204 63, 222 47" /><path d="M131 41 C143 37, 154 30, 166 18" /></svg>'
    ];
  }

  function createMarkerTextures() {
    return {
      globe: createMarkerTexture({ ring: "#c9a84c", core: "#f5f4f0", halo: "rgba(201, 168, 76, 0.18)" }),
      radar: createMarkerTexture({ ring: "#7c5cbf", core: "#f5f4f0", halo: "rgba(124, 92, 191, 0.18)" }),
      history: createMarkerTexture({ ring: "#f5f4f0", core: "#c9a84c", halo: "rgba(245, 244, 240, 0.12)" }),
      pandaZoo: createMarkerTexture({ ring: "#c9a84c", core: "#f5f4f0", halo: "rgba(201, 168, 76, 0.18)" }),
      pandaBreeding: createMarkerTexture({ ring: "#f5f4f0", core: "#c9a84c", halo: "rgba(245, 244, 240, 0.16)" }),
      pandaReserve: createMarkerTexture({ ring: "#7c5cbf", core: "#c9a84c", halo: "rgba(124, 92, 191, 0.22)" }),
      pandaActive: createMarkerTexture({ ring: "#f5f4f0", core: "#7c5cbf", halo: "rgba(245, 244, 240, 0.18)" }),
      nudibranch: createMarkerTexture({ ring: "#7c5cbf", core: "#f5f4f0", halo: "rgba(124, 92, 191, 0.18)" }),
      nudibranchActive: createMarkerTexture({ ring: "#c9a84c", core: "#7c5cbf", halo: "rgba(201, 168, 76, 0.18)" })
    };
  }

  function createMarkerTexture(colors) {
    const canvas = document.createElement("canvas");
    canvas.width = 96;
    canvas.height = 96;
    const context = canvas.getContext("2d");

    context.clearRect(0, 0, 96, 96);
    context.fillStyle = colors.halo;
    context.beginPath();
    context.arc(48, 48, 34, 0, Math.PI * 2);
    context.fill();

    context.strokeStyle = colors.ring;
    context.lineWidth = 8;
    context.beginPath();
    context.arc(48, 48, 22, 0, Math.PI * 2);
    context.stroke();

    context.fillStyle = colors.core;
    context.beginPath();
    context.arc(48, 48, 10, 0, Math.PI * 2);
    context.fill();

    return new THREE.CanvasTexture(canvas);
  }

  function getPandaTextureKey(kind) {
    if (kind === "reserve/base") {
      return "pandaReserve";
    }
    if (kind === "breeding center") {
      return "pandaBreeding";
    }
    return "pandaZoo";
  }

  function buildLiveTextureUrl() {
    const url = new URL("https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi");
    url.search = new URLSearchParams({
      SERVICE: "WMS",
      VERSION: "1.1.1",
      REQUEST: "GetMap",
      LAYERS: "BlueMarble_ShadedRelief",
      SRS: "EPSG:4326",
      BBOX: "-180,-90,180,90",
      WIDTH: String(TEXTURE_SIZE.width),
      HEIGHT: String(TEXTURE_SIZE.height),
      FORMAT: "image/jpeg",
      TIME: "2024-01-01"
    }).toString();
    return url.toString();
  }

  async function fetchJson(url) {
    const controller = new AbortController();
    const timer = window.setTimeout(function () {
      controller.abort();
    }, FETCH_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { Accept: "application/json" }
      });

      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }

      return await response.json();
    } finally {
      window.clearTimeout(timer);
    }
  }

  function latLngToVector3(lat, lng, radius) {
    const phi = (90 - lat) * Math.PI / 180;
    const theta = lng * Math.PI / 180;
    const sinPhi = Math.sin(phi);

    return new THREE.Vector3(
      radius * sinPhi * Math.cos(theta),
      radius * Math.cos(phi),
      -radius * sinPhi * Math.sin(theta)
    );
  }

  function pointToLatLng(point, radius) {
    const safeRadius = radius || 2;
    const phi = Math.acos(Math.max(-1, Math.min(1, point.y / safeRadius)));
    const theta = Math.atan2(-point.z, point.x);

    return {
      lat: 90 - (phi * 180 / Math.PI),
      lng: normalizeLng(theta * 180 / Math.PI)
    };
  }

  function normalizeLng(lng) {
    return ((lng + 180) % 360 + 360) % 360 - 180;
  }

  function getArrayValue(values, index) {
    return Array.isArray(values) ? Number(values[index]) : NaN;
  }

  function getCacheKey(lat, lng) {
    return `${lat.toFixed(1)},${lng.toFixed(1)}`;
  }

  function formatCoordsHtml(lat, lng) {
    return `${lat.toFixed(2)}&deg;, ${lng.toFixed(2)}&deg;`;
  }

  function formatApiDate(date) {
    return date.toISOString().slice(0, 10);
  }

  function formatHistoryLabel(value) {
    const date = new Date(`${value}T12:00:00Z`);
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric"
    });
  }

  function formatRadarTime(date) {
    return date.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit"
    });
  }

  function pad(value) {
    return String(value).padStart(2, "0");
  }

  function shuffle(values) {
    const copy = values.slice();

    for (let index = copy.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      const temporary = copy[index];
      copy[index] = copy[swapIndex];
      copy[swapIndex] = temporary;
    }

    return copy;
  }

  function wait(duration) {
    return new Promise(function (resolve) {
      window.setTimeout(resolve, duration);
    });
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function escapeAttribute(value) {
    return escapeHtml(value);
  }
})();
