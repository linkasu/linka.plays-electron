import { resolvePublicAssetUrl } from "../../core/publicAsset";

export type MosaicImage = {
  id: string;
  title: string;
  prompt: string;
  src: string;
  attribution: string;
  license: string;
  sourceUrl: string;
};

const mosaicImageDefinitions: MosaicImage[] = [
  {
    id: "kitten",
    title: "Котёнок",
    prompt: "Собери картинку с котёнком.",
    src: "/images/mosaic/kitten.jpg",
    attribution: "André Karwath aka Aka, Wikimedia Commons",
    license: "CC BY-SA 2.5",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Six_weeks_old_cat_(aka).jpg"
  },
  {
    id: "butterfly",
    title: "Бабочка",
    prompt: "Собери картинку с бабочкой.",
    src: "/images/mosaic/butterfly.jpg",
    attribution: "Charles J. Sharp, Wikimedia Commons",
    license: "CC BY-SA 3.0",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Peacock_butterfly_(Aglais_io)_2.jpg"
  },
  {
    id: "rabbit",
    title: "Кролик",
    prompt: "Собери картинку с кроликом.",
    src: "/images/mosaic/rabbit.jpg",
    attribution: "Keven Law from Los Angeles, USA, Wikimedia Commons",
    license: "CC BY-SA 2.0",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Flickr%20-%20law%20keven%20-%20Cute%20factor%20overload...-O))).jpg"
  },
  {
    id: "duck",
    title: "Утка",
    prompt: "Собери картинку с уткой.",
    src: "/images/mosaic/duck.jpg",
    attribution: "KKPCW, Wikimedia Commons",
    license: "CC BY-SA 4.0",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Duck%20sleeping%20on%20pond%20of%20Ochiai%20Park.jpg"
  },
  {
    id: "red-panda",
    title: "Красная панда",
    prompt: "Собери картинку с красной пандой.",
    src: "/images/mosaic/red-panda.jpg",
    attribution: "User Bernard Landgraf on de.wikipedia.org, Wikimedia Commons",
    license: "CC BY-SA 3.0",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Red%20Panda.JPG"
  },
  {
    id: "koala",
    title: "Коала",
    prompt: "Собери картинку с коалой.",
    src: "/images/mosaic/koala.jpg",
    attribution: "Guillaume Blanchard at French Wikipedia, Wikimedia Commons",
    license: "CC BY-SA 1.0",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Australia%20Cairns%20Koala.jpg"
  },
  {
    id: "deer",
    title: "Олень",
    prompt: "Собери картинку с оленем.",
    src: "/images/mosaic/deer.jpg",
    attribution: "Gordon Hatton, Wikimedia Commons",
    license: "CC BY-SA 2.0",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Sika%20deer%20stag%2C%20Studley%20Park%20-%20geograph.org.uk%20-%20651693.jpg"
  },
  {
    id: "owl",
    title: "Сова",
    prompt: "Собери картинку с совой.",
    src: "/images/mosaic/owl.jpg",
    attribution: "Wing-Chi Poon, Wikimedia Commons",
    license: "CC BY-SA 2.5",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Owl%20at%20Night.jpg"
  },
  {
    id: "fox",
    title: "Лиса",
    prompt: "Собери картинку с лисой.",
    src: "/images/mosaic/fox.jpg",
    attribution: "Dave Schaffer, U.S. Fish and Wildlife Service, Wikimedia Commons",
    license: "Public domain",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Urocyon%20cinereoargenteus%20in%20brushwood.jpg"
  },
  {
    id: "squirrel",
    title: "Белка",
    prompt: "Собери картинку с белкой.",
    src: "/images/mosaic/squirrel.jpg",
    attribution: "Diliff, Wikimedia Commons",
    license: "CC BY-SA 3.0",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Eastern%20Grey%20Squirrel%20in%20St%20James's%20Park%2C%20London%20-%20Nov%202006%20edit.jpg"
  },
  {
    id: "hedgehog",
    title: "Ёжик",
    prompt: "Собери картинку с ёжиком.",
    src: "/images/mosaic/hedgehog.jpg",
    attribution: "Igel01.jpg, Wikimedia Commons",
    license: "CC BY-SA 3.0",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Igel01.jpg"
  },
  {
    id: "penguin",
    title: "Пингвин",
    prompt: "Собери картинку с пингвином.",
    src: "/images/mosaic/penguin.jpg",
    attribution: "Christian Mehlführer, User:Chmehl, Wikimedia Commons",
    license: "CC BY 2.5",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Yellow-eyed%20Penguin%20crying%20MC.jpg"
  },
  {
    id: "turtle",
    title: "Черепаха",
    prompt: "Собери картинку с черепахой.",
    src: "/images/mosaic/turtle.jpg",
    attribution: "Brocken Inaglory, Wikimedia Commons",
    license: "CC BY-SA 3.0",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Hawaii%20turtle%202.JPG"
  },
  {
    id: "frog",
    title: "Лягушка",
    prompt: "Собери картинку с лягушкой.",
    src: "/images/mosaic/frog.jpg",
    attribution: "LiquidGhoul, Wikimedia Commons",
    license: "Public domain",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Australia%20green%20tree%20frog%20(Litoria%20caerulea)%20crop.jpg"
  },
  {
    id: "horse",
    title: "Лошадь",
    prompt: "Собери картинку с лошадью.",
    src: "/images/mosaic/horse.jpg",
    attribution: "Gianni Careddu, Wikimedia Commons",
    license: "CC BY-SA 4.0",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Equus%20ferus%20caballus%20(02).jpg"
  },
  {
    id: "sheep",
    title: "Овечка",
    prompt: "Собери картинку с овечкой.",
    src: "/images/mosaic/sheep.jpg",
    attribution: "Garst, Warren, 1922-2016, photographer, Wikimedia Commons",
    license: "CC BY-SA 4.0",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:American%20bighorn%20sheep%20standing%20close%20up%20-%20DPLA%20-%20476814877d9a46688f3c18184c9e171d.jpg"
  },
  {
    id: "bee",
    title: "Пчела",
    prompt: "Собери картинку с пчелой.",
    src: "/images/mosaic/bee.jpg",
    attribution: "Jon Sullivan, Wikimedia Commons",
    license: "Public domain",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Bee%20Collecting%20Pollen%202004-08-14.jpg"
  },
  {
    id: "ladybug",
    title: "Божья коровка",
    prompt: "Собери картинку с божьей коровкой.",
    src: "/images/mosaic/ladybug.jpg",
    attribution: "Shafquat Ameen, Wikimedia Commons",
    license: "CC BY-SA 4.0",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:A%20ladybug%20on%20a%20leaf.jpg"
  },
  {
    id: "sunflower",
    title: "Подсолнух",
    prompt: "Собери картинку с подсолнухом.",
    src: "/images/mosaic/sunflower.jpg",
    attribution: "böhringer friedrich, Wikimedia Commons",
    license: "CC BY-SA 2.5",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Sonnenblume%20Helianthus%201.JPG"
  },
  {
    id: "rose",
    title: "Роза",
    prompt: "Собери картинку с розой.",
    src: "/images/mosaic/rose.jpg",
    attribution: "Rameshng at Malayalam Wikipedia, Wikimedia Commons",
    license: "CC BY 3.0",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Rose%20flower%20at%20the%20Lalbaghgarden%20Bangalore.jpg"
  },
  {
    id: "mushroom",
    title: "Гриб",
    prompt: "Собери картинку с грибом.",
    src: "/images/mosaic/mushroom.jpg",
    attribution: "Netha Hussain, Wikimedia Commons",
    license: "CC BY-SA 3.0",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Mushroom%20in%20Swedish%20forest%202.jpg"
  },
  {
    id: "dolphin",
    title: "Дельфин",
    prompt: "Собери картинку с дельфином.",
    src: "/images/mosaic/dolphin.jpg",
    attribution: "NASA, Wikimedia Commons",
    license: "Public domain",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Tursiops%20truncatus%2001.jpg"
  }
];

export const mosaicImages = mosaicImageDefinitions.map((image) => ({
  ...image,
  src: resolvePublicAssetUrl(image.src)
}));
