(function (global) {
  var PANDA_LOCATIONS = [
    {
      id: "smithsonian-washington",
      name: "Smithsonian National Zoo",
      kind: "zoo",
      lat: 38.9298,
      lng: -77.0498,
      country: "United States",
      region: "Washington, DC",
      pandas: "Qing Bao and Bao Li",
      summary: "A longtime panda home in the U.S. capital, known for conservation work and a much-loved panda cam.",
      officialUrl: "https://nationalzoo.si.edu/animals/giant-pandas",
      camUrl: "https://nationalzoo.si.edu/webcams/panda-cam"
    },
    {
      id: "atlanta-zoo",
      name: "Zoo Atlanta",
      kind: "zoo",
      lat: 33.7427,
      lng: -84.3729,
      country: "United States",
      region: "Atlanta, Georgia",
      pandas: "Ya Lun and Xi Lun",
      summary: "One of the best-known giant panda habitats outside Asia, with a deep breeding and research history.",
      officialUrl: "https://zooatlanta.org/giant-pandas/"
    },
    {
      id: "memphis-zoo",
      name: "Memphis Zoo",
      kind: "zoo",
      lat: 35.1384,
      lng: -89.9771,
      country: "United States",
      region: "Memphis, Tennessee",
      pandas: "Ya Ya and Le Le (former residents)",
      summary: "A major early U.S. panda landmark that helped build public affection for the species.",
      officialUrl: "https://www.memphiszoo.org/giant-pandas"
    },
    {
      id: "san-diego-zoo",
      name: "San Diego Zoo",
      kind: "zoo",
      lat: 32.7353,
      lng: -117.1490,
      country: "United States",
      region: "San Diego, California",
      pandas: "Former giant panda program",
      summary: "A historic panda stop with strong conservation roots and a long, influential panda legacy.",
      officialUrl: "https://zoo.sandiegozoo.org/animals/giant-panda"
    },
    {
      id: "wolong-center",
      name: "Wolong National Nature Reserve",
      kind: "reserve/base",
      lat: 31.0327,
      lng: 103.1429,
      country: "China",
      region: "Sichuan",
      pandas: "Wild and reintroduced giant pandas",
      summary: "A misty mountain stronghold where panda conservation, research, and habitat protection meet.",
      officialUrl: "https://en.chinawolong.com/"
    },
    {
      id: "chengdu-research-base",
      name: "Chengdu Research Base of Giant Panda Breeding",
      kind: "breeding center",
      lat: 30.7464,
      lng: 104.1412,
      country: "China",
      region: "Chengdu, Sichuan",
      pandas: "Breeding and nursery population",
      summary: "A flagship panda breeding center where the species is studied in a lush, visitor-friendly setting.",
      officialUrl: "https://www.panda.org.cn/"
    },
    {
      id: "bifengxia",
      name: "Bifengxia Panda Base",
      kind: "breeding center",
      lat: 30.0478,
      lng: 102.8987,
      country: "China",
      region: "Ya'an, Sichuan",
      pandas: "Breeding population and rehabilitation cases",
      summary: "A quiet mountain base tied to rescue work, breeding care, and the softer side of panda conservation.",
      officialUrl: "https://www.pandahome.org/"
    },
    {
      id: "dujiangyan-base",
      name: "Dujiangyan Panda Base",
      kind: "breeding center",
      lat: 31.0013,
      lng: 103.6080,
      country: "China",
      region: "Dujiangyan, Sichuan",
      pandas: "Rescue, training, and release preparation",
      summary: "A practical and hopeful base focused on rescue, rewilding, and the careful work behind releases.",
      officialUrl: "https://www.panda.org.cn/"
    },
    {
      id: "chengdu-wolong-pengzhou",
      name: "Giant Panda National Park",
      kind: "reserve/base",
      lat: 31.2000,
      lng: 103.9000,
      country: "China",
      region: "Sichuan",
      pandas: "Wild giant panda habitat",
      summary: "A broad protected landscape of bamboo forest, mist, and mountain habitat that gives pandas room to roam.",
      officialUrl: "https://english.www.gov.cn/news/202112/21/content_WS61c172e5c6d09c94e48a2b19.html"
    },
    {
      id: "jiaodian-reserve",
      name: "Foping National Nature Reserve",
      kind: "reserve/base",
      lat: 33.6308,
      lng: 107.9925,
      country: "China",
      region: "Shaanxi",
      pandas: "Wild giant pandas",
      summary: "A forested reserve where pandas live in a quieter northern edge of their natural range.",
      officialUrl: "https://www.forestry.gov.cn/"
    },
    {
      id: "beijing-zoo",
      name: "Beijing Zoo",
      kind: "zoo",
      lat: 39.9380,
      lng: 116.3435,
      country: "China",
      region: "Beijing",
      pandas: "Breeding and display population",
      summary: "An urban panda stop in the capital, where visitors can meet the species close to the city center.",
      officialUrl: "http://www.bjzoo.com/"
    }
  ];

  global.PANDA_LOCATIONS = PANDA_LOCATIONS;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = PANDA_LOCATIONS;
  }
})(typeof window !== "undefined" ? window : globalThis);
