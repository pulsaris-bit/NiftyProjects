# Taskly - Moderne Taakbeheer Applicatie

Taskly is een krachtige en intuïtieve "Full-Stack" taakbeheer-applicatie ontworpen voor focus en efficiëntie. Gebruikers kunnen taken organiseren in verschillende "Spaces", prioriteiten toewijzen, labels gebruiken en de voortgang van hun werk visualiseren via flexibele weergaven.

## 🚀 Functionaliteiten

- **Spaces**: Organiseer werk in projecten of categorieën (bijv. Werk, Persoonlijk, Marketing).
- **Board View**: Een Kanban-stijl weergave met drag & drop ondersteuning voor status-beheer.
- **List View**: Een compacte lijstweergave voor snelle overzichten.
- **Labels**: Voeg aangepaste labels toe met kleuren voor betere categorisering.
- **Taakdetails**: Beheer titels, beschrijvingen, subtasks, bijlagen en links in een modern overlay-paneel.
- **Prioriteiten & Statussen**: Definieer hoe belangrijk een taak is en volg de status (To Do, In Progress, Review, Done).
- **Zoekfunctie**: Vind snel taken terug via de globale zoekbalk (zoekt in titels, beschrijvingen en labels).
- **Trash**: Verwijderde taken komen in de prullenbak terecht en kunnen worden hersteld of definitief verwijderd.
- **Profielbeheer**: Chat-gebaseerde profielinstellingen en voorkeuren.

## 🛠️ Technologieën

### Frontend
- **React**: Gebruikersinterface en state-management.
- **Tailwind CSS**: Utility-first styling voor een strak en aanpasbaar design.
- **Framer Motion**: Vloeiende animaties en transities.
- **Lucide React**: Consistente en moderne iconenset.
- **@dnd-kit**: Robuuste drag & drop functionaliteit voor het Kanban-bord.

### Backend
- **Express (Node.js)**: API-server die de applicatie aanstuurt.
- **SQLite (better-sqlite3)**: Lokale, snelle database voor het opslaan van taken, ruimtes en instellingen.
- **Vite**: Ontwikkelomgeving en build-tooling.

## 📂 Projectstructuur

```
├── server.ts           # Express backend server & API routes
├── src/
│   ├── App.tsx         # Hoofdcomponent met applicatielogica
│   ├── main.tsx        # Entry point voor de frontend
│   ├── types.ts        # TypeScript interfaces en types
│   ├── components/     # Reusable UI componenten (Modal, Profile, etc.)
│   ├── lib/            # Utilities en services (Auth, API)
│   └── index.css       # Globale stijlen en Tailwind configuratie
├── database.db         # SQLite database bestand (gegenereerd na opstarten)
└── package.json        # Dependencies en scripts
```

## ⚙️ Installatie & Gebruik

### Vereisten
- Node.js (versie 18 of hoger aanbevolen)
- npm of yarn

### Stappen
1. **Repository klonen of bestanden downloaden.**
2. **Afhankelijkheden installeren**:
   ```bash
   npm install
   ```
3. **Ontwikkelomgeving starten**:
   ```bash
   npm run dev
   ```
   *Dit start zowel de backend server op poort 3000 als de Vite ontwikkelomgeving.*

4. **De applicatie openen**:
   Navigeer in je browser naar `http://localhost:3000`.

## 📜 Licentie
Dit project is gebouwd als een "proof of concept" applicatie. Vrij om te gebruiken en aan te passen voor eigen doeleinden.
