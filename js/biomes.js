(function (global) {
  "use strict";

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function normalizeLng(lng) {
    var n = lng % 360;
    if (n > 180) n -= 360;
    if (n < -180) n += 360;
    return n;
  }

  function noise(lat, lng) {
    var x = lat * 0.081 + lng * 0.037;
    var y = lat * 0.021 - lng * 0.064;
    var z = lat * 0.013 + lng * 0.017;
    var value =
      Math.sin(x * Math.PI * 2) * 0.45 +
      Math.cos(y * Math.PI * 2) * 0.33 +
      Math.sin(z * Math.PI * 2 + 1.7) * 0.22;
    return (value + 1) / 2;
  }

  var BIOMES = {
    "tropical rainforest": {
      biome: "tropical rainforest",
      landscape: "dense canopy",
      soil: "deep humus",
      description:
        "A lush green hush hangs in the air, where layered leaves hold warmth, rain, and a feeling of endless life.",
    },
    "tropical savanna": {
      biome: "tropical savanna",
      landscape: "open grassland",
      soil: "iron-rich earth",
      description:
        "Golden grass and scattered trees stretch wide under a bright sky, softening heat into a sunlit rhythm.",
    },
    desert: {
      biome: "desert",
      landscape: "wind-carved dunes",
      soil: "dry mineral sand",
      description:
        "The land feels spare and glowing, with wide silence, sharp light, and earth that holds heat long after sunset.",
    },
    mediterranean: {
      biome: "Mediterranean",
      landscape: "scrub hills",
      soil: "stony loam",
      description:
        "A breeze-bent coastland of herbs, olives, and sun-warmed stone, made for long dry days and gentle nights.",
    },
    "temperate oceanic": {
      biome: "temperate oceanic",
      landscape: "soft green valleys",
      soil: "moist loam",
      description:
        "Mild air and frequent mist give the ground a velvet look, as if the world is always just after rain.",
    },
    "humid continental": {
      biome: "humid continental",
      landscape: "broad mixed forests",
      soil: "fertile brown earth",
      description:
        "Seasons move boldly here, painting the trees in shifting colors and leaving the soil rich and generous.",
    },
    "subarctic/taiga": {
      biome: "subarctic/taiga",
      landscape: "dark conifer forest",
      soil: "cold acidic peat",
      description:
        "Tall evergreens stand in a long quiet, their needles and shade giving the land a stern but beautiful patience.",
    },
    tundra: {
      biome: "tundra",
      landscape: "low moss flats",
      soil: "frozen thin topsoil",
      description:
        "The ground stays close to the sky here, with moss, lichen, and a bright stillness that feels almost lunar.",
    },
    "polar ice": {
      biome: "polar ice",
      landscape: "ice fields",
      soil: "ice and wind-polished rock",
      description:
        "White surfaces and hard blue shadows make the world feel distilled, quiet, and astonishingly pure.",
    },
    "open ocean": {
      biome: "open ocean",
      landscape: "open water",
      soil: "saltwater realm",
      description:
        "Water becomes the whole horizon, rolling with a deep blue calm that feels spacious and far-reaching.",
    },
    "coastal/reef": {
      biome: "coastal/reef",
      landscape: "reef edge and shore",
      soil: "coral sand",
      description:
        "Warm shallows and bright edges meet in a lively fringe where the sea feels close enough to touch by hand.",
    },
  };

  function getBiome(lat, lng) {
    var latitude = clamp(Number(lat) || 0, -90, 90);
    var longitude = normalizeLng(Number(lng) || 0);
    var absLat = Math.abs(latitude);
    var n = noise(latitude, longitude);
    var coastalHint = Math.abs(Math.sin((longitude + latitude * 0.8) * Math.PI / 36)) < 0.18;
    var reefHint = absLat < 28 && Math.abs(Math.cos((longitude - latitude) * Math.PI / 48)) < 0.22;
    var oceanHint =
      absLat < 78 &&
      (Math.sin((longitude + latitude) * Math.PI / 30) + Math.cos((longitude - latitude) * Math.PI / 42)) / 2 > 0.72;

    if (absLat >= 82) {
      return BIOMES["polar ice"];
    }

    if (absLat >= 72) {
      if (n > 0.72) return BIOMES.tundra;
      return BIOMES["polar ice"];
    }

    if (oceanHint && absLat > 18) {
      return BIOMES["open ocean"];
    }

    if ((reefHint || coastalHint) && latitude > -32 && latitude < 32 && n > 0.58) {
      return BIOMES["coastal/reef"];
    }

    if (absLat < 10) {
      if (n < 0.42) return BIOMES["tropical rainforest"];
      return BIOMES["tropical savanna"];
    }

    if (absLat < 23) {
      if (n < 0.34) return BIOMES.desert;
      if (n < 0.64) return BIOMES["tropical savanna"];
      return BIOMES["tropical rainforest"];
    }

    if (absLat < 35) {
      if (n < 0.25) return BIOMES.desert;
      if (n < 0.5) return BIOMES.mediterranean;
      if (n < 0.75) return BIOMES["coastal/reef"];
      return BIOMES["tropical savanna"];
    }

    if (absLat < 48) {
      if (n < 0.28) return BIOMES.mediterranean;
      if (n < 0.56) return BIOMES["temperate oceanic"];
      if (n < 0.82) return BIOMES["humid continental"];
      return BIOMES.desert;
    }

    if (absLat < 60) {
      if (n < 0.2) return BIOMES["temperate oceanic"];
      if (n < 0.52) return BIOMES["humid continental"];
      if (n < 0.8) return BIOMES["subarctic/taiga"];
      return BIOMES["temperate oceanic"];
    }

    if (absLat < 72) {
      if (n < 0.35) return BIOMES["subarctic/taiga"];
      if (n < 0.7) return BIOMES.tundra;
      return BIOMES["humid continental"];
    }

    if (n < 0.5) return BIOMES.tundra;
    return BIOMES["polar ice"];
  }

  global.getBiome = getBiome;
  global.BIOME_PRESETS = BIOMES;
})(typeof window !== "undefined" ? window : globalThis);
