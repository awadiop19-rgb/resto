import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import bcrypt from "bcryptjs";

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL ?? "file:./dev.db",
});
const prisma = new PrismaClient({ adapter });

async function main() {
  const adminPassword = await bcrypt.hash("admin123", 10);
  const admin = await prisma.user.upsert({
    where: { email: "admin@resto.com" },
    update: {},
    create: {
      name: "Administrateur",
      email: "admin@resto.com",
      password: adminPassword,
      role: "ADMIN",
    },
  });

  const serveurPassword = await bcrypt.hash("serveur123", 10);
  await prisma.user.upsert({
    where: { email: "serveur@resto.com" },
    update: {},
    create: {
      name: "Serveur Demo",
      email: "serveur@resto.com",
      password: serveurPassword,
      role: "SERVEUR",
    },
  });

  const cuisinePassword = await bcrypt.hash("cuisine123", 10);
  await prisma.user.upsert({
    where: { email: "cuisine@resto.com" },
    update: {},
    create: {
      name: "Cuisine Demo",
      email: "cuisine@resto.com",
      password: cuisinePassword,
      role: "CUISINE",
    },
  });

  const caissierPassword = await bcrypt.hash("caissier123", 10);
  await prisma.user.upsert({
    where: { email: "caissier@resto.com" },
    update: {},
    create: {
      name: "Caissier Demo",
      email: "caissier@resto.com",
      password: caissierPassword,
      role: "CAISSIER",
    },
  });

  const entrees = await prisma.menuCategory.upsert({
    where: { name: "Entrées" },
    update: {},
    create: { name: "Entrées" },
  });
  const plats = await prisma.menuCategory.upsert({
    where: { name: "Plats" },
    update: {},
    create: { name: "Plats" },
  });
  const desserts = await prisma.menuCategory.upsert({
    where: { name: "Desserts" },
    update: {},
    create: { name: "Desserts" },
  });
  const boissons = await prisma.menuCategory.upsert({
    where: { name: "Boissons" },
    update: {},
    create: { name: "Boissons" },
  });

  const menuItems = [
    {
      name: "Salade César",
      description: "Salade romaine, poulet grillé, copeaux de parmesan, sauce César maison",
      imageUrl: "https://images.pexels.com/photos/28618644/pexels-photo-28618644.jpeg",
      price: 3500,
      categoryId: entrees.id,
    },
    { name: "Soupe du jour", description: "Selon arrivage", imageUrl: null, price: 2000, categoryId: entrees.id },
    {
      name: "Pastels",
      description: "Beignets sénégalais farcis au poisson épicé, servis avec une sauce piquante",
      imageUrl: "/dishes/pastels.jpg",
      price: 2500,
      categoryId: entrees.id,
    },
    {
      name: "Poulet Yassa",
      description: "Poulet mariné et grillé aux oignons confits, citron et moutarde, riz blanc",
      imageUrl: "/dishes/yassa-poulet.webp",
      price: 5500,
      categoryId: plats.id,
    },
    {
      name: "Thiéboudienne",
      description: "Le plat national sénégalais : riz au poisson mijoté avec légumes et sauce tomate",
      imageUrl: "/dishes/thieboudienne.webp",
      price: 6000,
      categoryId: plats.id,
    },
    {
      name: "Mafé",
      description: "Bœuf mijoté longuement dans une onctueuse sauce à l'arachide, riz blanc",
      imageUrl: "/dishes/mafe.webp",
      price: 5800,
      categoryId: plats.id,
    },
    {
      name: "Pizza Margherita",
      description: "Sauce tomate, mozzarella fior di latte, basilic frais, huile d'olive",
      imageUrl: "https://images.pexels.com/photos/31450842/pexels-photo-31450842.jpeg",
      price: 4500,
      categoryId: plats.id,
    },
    {
      name: "Pâtes Carbonara",
      description: "Tagliatelles, lardons, crème fraîche, parmesan et jaune d'œuf",
      imageUrl: "https://images.pexels.com/photos/29039084/pexels-photo-29039084.jpeg",
      price: 4800,
      categoryId: plats.id,
    },
    {
      name: "Steak Frites",
      description: "Entrecôte grillée, frites maison et beurre maître d'hôtel",
      imageUrl: "https://images.pexels.com/photos/28992200/pexels-photo-28992200.jpeg",
      price: 7000,
      categoryId: plats.id,
    },
    {
      name: "Thiakry",
      description: "Dessert traditionnel au mil, lait caillé et arôme de fleur d'oranger",
      imageUrl: "/dishes/thiakry.jpg",
      price: 1800,
      categoryId: desserts.id,
    },
    {
      name: "Tiramisu",
      description: "Le classique italien au café, mascarpone et cacao",
      imageUrl: "https://images.pexels.com/photos/37037685/pexels-photo-37037685.jpeg",
      price: 2500,
      categoryId: desserts.id,
    },
    {
      name: "Jus de bissap",
      description: "Boisson locale glacée à l'hibiscus, parfumée à la menthe",
      imageUrl: "/dishes/bissap.jpg",
      price: 1000,
      categoryId: boissons.id,
    },
    { name: "Eau minérale", description: "50cl", imageUrl: null, price: 500, categoryId: boissons.id },
  ];

  for (const item of menuItems) {
    const existing = await prisma.menuItem.findFirst({ where: { name: item.name } });
    if (existing) {
      await prisma.menuItem.update({
        where: { id: existing.id },
        data: { description: item.description, imageUrl: item.imageUrl },
      });
    } else {
      await prisma.menuItem.create({ data: item });
    }
  }

  console.log("Seed terminé. Utilisateur admin :", admin.email);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
