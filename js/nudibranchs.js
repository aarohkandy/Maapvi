(function (global) {
  "use strict";

  var NUDIBRANCH_REGIONS = [
    {
      id: "monterey-kelp",
      name: "Monterey Kelp Forests",
      lat: 36.6177,
      lng: -121.9048,
      waters: "Central California",
      summary: "Cold kelp forests and surge channels make this coast a classic nudibranch stop with bright colors against deep green water.",
      species: [
        {
          scientificName: "Flabellina iodinea",
          commonName: "Spanish shawl",
          note: "Favors kelp and hydroid-covered reefs along the eastern Pacific coast."
        },
        {
          scientificName: "Triopha catalinae",
          commonName: "Clown nudibranch",
          note: "Often spotted over sponges and rocky ledges in cooler Pacific water."
        }
      ]
    },
    {
      id: "anilao-philippines",
      name: "Anilao Reefs",
      lat: 13.7572,
      lng: 120.8828,
      waters: "Batangas, Philippines",
      summary: "This coral-rich macro diving hotspot is famous for nudibranch diversity packed into warm reef slopes and rubble fields.",
      species: [
        {
          scientificName: "Chromodoris willani",
          commonName: "Willan's chromodoris",
          note: "A blue-and-black chromodoris often found on reef walls and sponge patches."
        },
        {
          scientificName: "Nembrotha lineolata",
          commonName: "Lined nembrotha",
          note: "A bold sea slug that turns up on coral rubble and soft-bottom macro sites."
        }
      ]
    },
    {
      id: "raja-ampat",
      name: "Raja Ampat Reefs",
      lat: -0.4217,
      lng: 130.8189,
      waters: "West Papua, Indonesia",
      summary: "Warm coral gardens, current-fed walls, and extraordinary biodiversity make this one of the most vivid nudibranch regions on Earth.",
      species: [
        {
          scientificName: "Hypselodoris apolegma",
          commonName: "Pink hypselodoris",
          note: "Known for broad lilac coloring and found around sponge-covered tropical reef faces."
        },
        {
          scientificName: "Chromodoris magnifica",
          commonName: "Magnificent chromodoris",
          note: "A high-contrast reef nudibranch often seen in the Coral Triangle."
        }
      ]
    },
    {
      id: "sydney-coast",
      name: "Sydney Coast",
      lat: -33.8634,
      lng: 151.2851,
      waters: "New South Wales, Australia",
      summary: "Temperate reef edges and sheltered coves around Sydney support some of the most recognizable southern nudibranch species.",
      species: [
        {
          scientificName: "Ceratosoma amoenum",
          commonName: "Clown nudibranch",
          note: "A flamboyant Australian species common on sponge-rich temperate reefs."
        },
        {
          scientificName: "Hypselodoris bennetti",
          commonName: "Bennett's hypselodoris",
          note: "Often seen cruising over shallow reef and sandstone habitats."
        }
      ]
    },
    {
      id: "okinawa",
      name: "Okinawa Reefs",
      lat: 26.3344,
      lng: 127.8056,
      waters: "Ryukyu Islands, Japan",
      summary: "Clear subtropical reefs around Okinawa bring together bright chromodorids and soft-coral specialists.",
      species: [
        {
          scientificName: "Glossodoris atromarginata",
          commonName: "Black-edged glossodoris",
          note: "A wide-ranging tropical species often recorded on warm Indo-Pacific reefs."
        },
        {
          scientificName: "Goniobranchus coi",
          commonName: "Coi's chromodoris",
          note: "Frequently photographed in Japanese and western Pacific reef systems."
        }
      ]
    },
    {
      id: "red-sea",
      name: "Red Sea Reefs",
      lat: 27.2579,
      lng: 33.8116,
      waters: "Egyptian Red Sea",
      summary: "Sunlit reef shelves and clear desert seas make the Red Sea a vivid place for chromodorid nudibranchs.",
      species: [
        {
          scientificName: "Chromodoris quadricolor",
          commonName: "Pyjama nudibranch",
          note: "A Red Sea favorite with a striped mantle and bright orange gills."
        },
        {
          scientificName: "Nembrotha megalocera",
          commonName: "Orange-lined nembrotha",
          note: "A heavier-bodied nudibranch often seen around sponges and reef rubble."
        }
      ]
    },
    {
      id: "mediterranean",
      name: "Mediterranean Drift",
      lat: 38.1790,
      lng: 15.5540,
      waters: "Central Mediterranean",
      summary: "Warmer pockets of the Mediterranean still host elegant nudibranchs threading through algae, rock, and shallow reefs.",
      species: [
        {
          scientificName: "Felimare picta",
          commonName: "Regal sea goddess",
          note: "One of the Mediterranean's larger showy nudibranchs, often found on sponge grounds."
        },
        {
          scientificName: "Flabellina affinis",
          commonName: "Mediterranean flabellina",
          note: "A slimmer aeolid that tends to follow hydroids and current-washed rock."
        }
      ]
    },
    {
      id: "atlantic-drift",
      name: "Atlantic Drift",
      lat: 31.4,
      lng: -43.8,
      waters: "Subtropical Atlantic",
      summary: "Pelagic nudibranchs ride floating blue-water communities, far from shore and far from the usual reef scene.",
      species: [
        {
          scientificName: "Glaucus atlanticus",
          commonName: "Blue dragon",
          note: "A free-drifting pelagic nudibranch carried by currents across warmer open-ocean waters."
        }
      ]
    }
  ];

  global.NUDIBRANCH_REGIONS = NUDIBRANCH_REGIONS;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = NUDIBRANCH_REGIONS;
  }
})(typeof window !== "undefined" ? window : globalThis);
