const CV_URL =
  "https://docs.google.com/document/d/e/2PACX-1vSQt4lmLAWF2fBpHJ2M-iwltF8C_LwE1awj1Ui_1BcVap4RJPUSJzGzOk_6zGRxGahWDBhtW5YHEHaX/pub";

const PROJECT_LINK_FALLBACKS = {
  "Huntd.tech":
    "https://docs.google.com/spreadsheets/d/1YTyK6Wlv7TnhXNufBGpG7VChfABIn7kfuzIaooESWPM/edit?usp=sharing",
  "Conduit":
    "https://elenimarbs.atlassian.net/jira/software/projects/KAN/list?jql=project%20%3D%20KAN%20ORDER%20BY%20created%20DESC",
  "Coffee Cart":
    "https://docs.google.com/document/d/12X6jxsVsI1KOPtw3utKzTIWxFKtmkfEy6vedcAxLpjE/edit?usp=sharing",
  "Wizard Bank":
    "https://docs.google.com/document/d/1KWjNKiyWxxccmv8fwM92aJjTvX553tFIiO8kS5s81fs/edit?usp=sharing",
};

const PROJECT_TAGS = {
  "Huntd.tech": ["TestRail", "Jira", "Bug report"],
  Conduit: ["Postman", "API REST", "Playwright"],
  "Coffee Cart": ["Playwright", "UI tests", "Assertions"],
  "Wizard Bank": ["Playwright", "Fluxos de usuário", "Regras de negócio"],
};

function decodeEntities(value) {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)));
}

function cleanText(value) {
  return decodeEntities(value)
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\s+([,.;:])/g, "$1")
    .trim();
}

function stripHtmlToLines(html) {
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<\/(p|h1|h2|h3|li|td|tr|div|ul|ol)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "");

  return cleanText(text)
    .split(/\n+/)
    .map(cleanText)
    .filter(Boolean)
    .filter((line) => line !== "#")
    .map((line) => line.replace(/^#+\s*/, "").trim())
    .filter(Boolean);
}

function extractDocContent(html) {
  const match = html.match(/<div class="[^"]*\bdoc-content\b[^"]*">([\s\S]*?)<\/div><\/div><script/i);
  if (!match) {
    throw new Error("Nao consegui encontrar o conteudo principal do Google Docs publicado.");
  }
  return match[1];
}

function normalizeUrl(href) {
  const decoded = decodeEntities(href);
  try {
    const url = new URL(decoded);
    const target = url.searchParams.get("q");
    return target || decoded;
  } catch {
    return decoded;
  }
}

function extractLinks(docHtml) {
  const links = [];
  const pattern = /<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = pattern.exec(docHtml))) {
    links.push({
      text: cleanText(match[2].replace(/<[^>]+>/g, "")),
      href: normalizeUrl(match[1]),
    });
  }
  return links;
}

function linesBetween(lines, startPattern, endPattern) {
  const start = lines.findIndex((line) => startPattern.test(line));
  if (start === -1) return [];
  const end = lines.findIndex((line, index) => index > start && endPattern.test(line));
  return lines.slice(start + 1, end === -1 ? lines.length : end);
}

function findLine(lines, pattern, fallback = "") {
  return lines.find((line) => pattern.test(line)) || fallback;
}

function getLink(links, textPattern, fallback = "#") {
  return links.find((link) => textPattern.test(link.text))?.href || fallback;
}

function projectLink(links, projectName) {
  const orderedProjectLinks = links.filter((link) => /Projeto completo/i.test(link.text));
  const indexByProject = {
    "Huntd.tech": 0,
    Conduit: 1,
    "Coffee Cart": 2,
    "Wizard Bank": 3,
  };
  return orderedProjectLinks[indexByProject[projectName]]?.href || PROJECT_LINK_FALLBACKS[projectName];
}

function extractProject(lines, links, name, nextPattern) {
  const start = lines.findIndex((line) => line.includes(name));
  if (start === -1) {
    return null;
  }

  const tail = lines.slice(start + 1);
  const end = tail.findIndex((line) => nextPattern.test(line));
  const block = tail.slice(0, end === -1 ? tail.length : end);
  const description = block.find((line) => !/Projeto completo/i.test(line)) || "";
  const bullets = block
    .filter((line) => line !== description)
    .filter((line) => !/Projeto completo/i.test(line))
    .slice(0, 5);

  return {
    name,
    type:
      name === "Huntd.tech"
        ? "Web e mobile"
        : name === "Conduit"
          ? "API + UI"
          : "Automação UI",
    description,
    bullets,
    tags: PROJECT_TAGS[name] || ["QA"],
    link: projectLink(links, name),
  };
}

function parseCv(html) {
  const docHtml = extractDocContent(html);
  const lines = stripHtmlToLines(docHtml);
  const links = extractLinks(docHtml);

  const email = findLine(lines, /^[^\s@]+@[^\s@]+\.[^\s@]+$/);
  const phone = findLine(lines, /^\+55\s+\d{2}\s+\d{5}\s+\d{4}$/);
  const whatsappDigits = phone.replace(/\D/g, "");
  const linkedin = getLink(links, /LinkedIn/i, "https://www.linkedin.com/in/elenimar-barbosa-da-silva-1a239061/");
  const github = getLink(links, /GitHub/i, "https://github.com/Elenimar1");

  const summary = linesBetween(lines, /^RESUMO$/i, /^COMPETÊNCIAS TÉCNICAS/i).slice(0, 2);
  const skills = linesBetween(lines, /^COMPETÊNCIAS TÉCNICAS/i, /^EXPERIÊNCIA PRÁTICA/i);
  const qaExperience = linesBetween(lines, /^QA Analyst Intern/i, /^Resultado:/i);
  const previousExperience = linesBetween(lines, /^Especialista em Vendas/i, /^Diferencial aplicado ao QA:/i);

  const projects = [
    extractProject(lines, links, "Huntd.tech", /^Conduit/i),
    extractProject(lines, links, "Conduit", /^Coffee Cart/i),
    extractProject(lines, links, "Coffee Cart", /^Wizard Bank/i),
    extractProject(lines, links, "Wizard Bank", /^EXPERIÊNCIA ANTERIOR/i),
  ].filter(Boolean);

  return {
    name: lines[0] || "Elenimar Barbosa",
    title: lines[1] || "Engenheira QA",
    phone,
    whatsappUrl: `https://wa.me/${whatsappDigits}`,
    email,
    linkedin,
    github,
    location: findLine(lines, /Tibau do Sul/i, "Tibau do Sul, Brasil, remoto"),
    summary,
    skills,
    qaExperience,
    previousExperience,
    projects,
  };
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function sentence(value) {
  const cleaned = value.trim();
  if (!cleaned) return "";
  return /[.!?]$/.test(cleaned) ? cleaned : `${cleaned}.`;
}

function wrapParagraph(value, indent = "              ") {
  const words = value.split(/\s+/);
  const lines = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > 78) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines.map((line) => `${indent}${escapeHtml(line)}`).join("\n");
}

function listItems(items, indent = "            ") {
  return items.map((item) => `${indent}<li>${escapeHtml(item)}</li>`).join("\n");
}

function tagItems(items) {
  return items.map((item) => `              <li>${escapeHtml(item)}</li>`).join("\n");
}

function renderIndex(cv) {
  const introParagraphs = cv.summary.map(
    (paragraph) => `            <p>\n${wrapParagraph(paragraph)}\n            </p>`,
  );

  const skillCards = [
    ["01", "Testes e metodologias", cv.skills[0] || ""],
    ["02", "Ferramentas de QA", cv.skills[1] || ""],
    ["03", "API, dados e web", cv.skills[2] || ""],
    ["04", "Comunicação", cv.skills[3] || "Idiomas: Ingles intermediario."],
  ]
    .map(
      ([number, title, description]) => `          <article class="skill-card">
            <span class="skill-marker">${number}</span>
            <h3>${escapeHtml(title)}</h3>
            <p>${escapeHtml(description.replace(/^[^:]+:\s*/, ""))}</p>
          </article>`,
    )
    .join("\n");

  const qaDate = cv.qaExperience[0] || "Out 2024 - Jan 2025 (extensao ate Abr 2025)";
  const qaBullets = cv.qaExperience.slice(1, 5).map((line) => line.replace(/\.$/, "."));
  const previousDate = cv.previousExperience[0] || "2012 - 2024";
  const previousBullets = cv.previousExperience.slice(1, 4);

  const projectCards = cv.projects
    .map(
      (project) => `          <article class="project-card">
            <div>
              <p class="project-type">${escapeHtml(project.type)}</p>
              <h3>${escapeHtml(project.name)}</h3>
              <p>
${wrapParagraph([project.description, ...project.bullets.slice(0, 2)].map(sentence).join(" "))}
              </p>
            </div>
            <ul class="tag-list">
${tagItems(project.tags)}
            </ul>
            <a class="text-link" href="${escapeHtml(project.link)}" target="_blank" rel="noreferrer">
              Ver projeto
            </a>
          </article>`,
    )
    .join("\n\n");

  return `<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta
      name="description"
      content="Portfólio de ${escapeHtml(cv.name)}, ${escapeHtml(cv.title)} com experiência em testes manuais, automação, APIs e documentação de qualidade."
    >
    <title>${escapeHtml(cv.name)} | Portfólio QA</title>
    <link rel="preload" href="assets/qa-portfolio-hero.png" as="image">
    <link rel="stylesheet" href="styles.css">
  </head>
  <body>
    <header class="site-header" aria-label="Cabeçalho">
      <a class="brand" href="#inicio">${escapeHtml(cv.name)}</a>
      <nav class="nav" aria-label="Navegação principal">
        <a href="#sobre">Sobre</a>
        <a href="#competencias">Competências</a>
        <a href="#experiencia">Experiência</a>
        <a href="#projetos">Projetos</a>
        <a href="#contato">Contato</a>
      </nav>
    </header>

    <main id="inicio">
      <section class="hero" aria-labelledby="hero-title">
        <img
          class="hero-image"
          src="assets/qa-portfolio-hero.png"
          alt="Mesa de trabalho com checklist de testes, relatórios de bugs e fluxo de automação em uma tela de notebook."
        >
        <div class="hero-overlay"></div>
        <div class="hero-content">
          <p class="eyebrow">${escapeHtml(cv.title)} | Testes manuais | Automação</p>
          <h1 id="hero-title">${escapeHtml(cv.name)}</h1>
          <p class="hero-copy">
            Quality Assurance com visão centrada no usuário, experiência prática em
            testes, documentação, reporte de bugs e automação de fluxos críticos.
          </p>
          <div class="hero-actions">
            <a class="button primary" href="#projetos">Ver projetos</a>
            <a class="button secondary" href="mailto:${escapeHtml(cv.email)}">
              Enviar e-mail
            </a>
          </div>
        </div>
      </section>

      <section class="section intro-section" id="sobre" aria-labelledby="sobre-title">
        <div class="section-heading">
          <p class="eyebrow">Sobre</p>
          <h2 id="sobre-title">Perfil profissional</h2>
        </div>
        <div class="intro-grid">
          <div class="intro-text">
${introParagraphs.join("\n")}
          </div>
          <dl class="profile-facts">
            <div>
              <dt>Localização</dt>
              <dd>${escapeHtml(cv.location.replace(/,\s*remoto/i, " | Remoto"))}</dd>
            </div>
            <div>
              <dt>Foco</dt>
              <dd>Testes manuais, API, UI e automação</dd>
            </div>
            <div>
              <dt>Diferencial</dt>
              <dd>Visão de usuário, negócio e suporte ao cliente</dd>
            </div>
          </dl>
        </div>
      </section>

      <section class="section skills-section" id="competencias" aria-labelledby="competencias-title">
        <div class="section-heading">
          <p class="eyebrow">Competências</p>
          <h2 id="competencias-title">Competências técnicas</h2>
        </div>
        <div class="skills-grid">
${skillCards}
        </div>
      </section>

      <section class="section experience-section" id="experiencia" aria-labelledby="experiencia-title">
        <div class="section-heading">
          <p class="eyebrow">Experiência</p>
          <h2 id="experiencia-title">Experiência em QA</h2>
        </div>
        <article class="experience-card">
          <div>
            <p class="project-type">${escapeHtml(qaDate)}</p>
            <h3>QA Analyst Intern - Field Technology</h3>
            <p>
${wrapParagraph("Estruturei o processo inicial de QA no sistema de gestão agropecuária FieldPec, criando documentação, fluxos, checklists e casos de teste para apoiar a qualidade do produto.")}
            </p>
          </div>
          <ul class="achievement-list">
${listItems(qaBullets)}
          </ul>
        </article>
        <article class="experience-card secondary-card">
          <div>
            <p class="project-type">${escapeHtml(previousDate)}</p>
            <h3>Vendas e Suporte ao Cliente</h3>
            <p>
${wrapParagraph("Experiência anterior em negociação, relacionamento, suporte pós-venda e atendimento ao cliente.")}
            </p>
          </div>
          <ul class="achievement-list">
${listItems(previousBullets)}
          </ul>
        </article>
      </section>

      <section class="section projects-section" id="projetos" aria-labelledby="projetos-title">
        <div class="section-heading">
          <p class="eyebrow">Projetos</p>
          <h2 id="projetos-title">Projetos de QA</h2>
        </div>
        <div class="projects-grid">
${projectCards}
        </div>
      </section>

      <section class="section contact-section" id="contato" aria-labelledby="contato-title">
        <div class="section-heading">
          <p class="eyebrow">Contato</p>
          <h2 id="contato-title">Vamos conversar</h2>
        </div>
        <div class="contact-panel">
          <p>
            Aberta a oportunidades remotas em QA, com foco em testes manuais,
            validação de APIs, documentação e evolução em automação.
            <span class="email-note">E-mail: ${escapeHtml(cv.email)}</span>
            <span class="email-note">WhatsApp: ${escapeHtml(cv.phone)}</span>
          </p>
          <div class="contact-actions">
            <a class="button primary" href="mailto:${escapeHtml(cv.email)}">
              Enviar e-mail
            </a>
            <a class="button secondary" href="${escapeHtml(cv.whatsappUrl)}" target="_blank" rel="noreferrer">
              WhatsApp
            </a>
            <a class="button secondary" href="${escapeHtml(cv.linkedin)}" target="_blank" rel="noreferrer">
              LinkedIn
            </a>
          </div>
        </div>
        <ul class="contact-list">
          <li><a href="mailto:${escapeHtml(cv.email)}">${escapeHtml(cv.email)}</a></li>
          <li><a href="${escapeHtml(cv.whatsappUrl)}" target="_blank" rel="noreferrer">WhatsApp</a></li>
          <li><a href="${escapeHtml(cv.github)}" target="_blank" rel="noreferrer">github.com/Elenimar1</a></li>
          <li><a href="${escapeHtml(cv.linkedin)}" target="_blank" rel="noreferrer">LinkedIn</a></li>
        </ul>
      </section>
    </main>

    <footer class="site-footer">
      <p>&copy; <span id="year"></span> ${escapeHtml(cv.name)}. Portfólio publicado com GitHub Pages.</p>
    </footer>

    <script src="script.js"></script>
  </body>
</html>
`;
}

function renderReadme(cv) {
  return `# ${cv.name} | Portfólio QA

Site pessoal de ${cv.name}, ${cv.title} com experiência em testes manuais,
automação, validação de APIs, documentação de qualidade e reporte estruturado de bugs.

## Site

\`\`\`text
https://elenimar1.github.io/
\`\`\`

## Destaques

- Experiência em QA na Field Technology, com estruturação inicial de processo de qualidade
- Mais de 100 casos de teste criados e executados em fluxos críticos
- 21 bugs identificados e documentados
- Projetos práticos com Jira, TestRail, Postman, Playwright, Chrome DevTools e DBeaver
- Background em vendas e suporte ao cliente aplicado à visão de usuário e usabilidade

## Estrutura

\`\`\`text
.
├── assets/
│   └── qa-portfolio-hero.png
├── github-profile-readme.md
├── index.html
├── script.js
└── styles.css
\`\`\`

## Contato

- E-mail: [${cv.email}](mailto:${cv.email})
- WhatsApp: [${cv.phone}](${cv.whatsappUrl})
- LinkedIn: [${cv.name}](${cv.linkedin})
- GitHub: [Elenimar1](${cv.github})
`;
}

function renderProfileReadme(cv) {
  const projectRows = cv.projects
    .map((project) => `| ${project.name} | ${project.description} | ${project.tags.join(", ")} |`)
    .join("\n");

  return `# Olá, eu sou ${cv.name}

Sou ${cv.title} com experiência em testes manuais, automação, testes de API,
documentação de QA e reporte de bugs. Tenho também um background sólido em vendas e
suporte ao cliente, o que fortalece minha visão de usabilidade, negócio e experiência
do usuário.

## Competências

- Testes manuais, exploratórios, regressivos, sanidade, SDLC e STLC
- Automação de testes com Playwright
- Testes de API com Postman e validação de payloads JSON
- Jira, TestRail, Chrome DevTools e DBeaver
- SQL, HTML, CSS, JavaScript, Git e GitHub

## Experiência

**QA Analyst Intern - Field Technology**
${cv.qaExperience[0] || "Out 2024 - Jan 2025, com extensão até Abr 2025"}

- Estruturei o processo inicial de QA no sistema FieldPec
- Criei e executei mais de 100 casos de teste
- Identifiquei e documentei 21 bugs
- Elaborei plano de testes, checklists, fluxos e diagramas
- Realizei testes funcionais, exploratórios e regressivos

## Projetos em destaque

| Projeto | Foco | Ferramentas |
| --- | --- | --- |
${projectRows}

## Contato

- E-mail: [${cv.email}](mailto:${cv.email})
- WhatsApp: [${cv.phone}](${cv.whatsappUrl})
- LinkedIn: [${cv.name}](${cv.linkedin})
- GitHub: [github.com/Elenimar1](${cv.github})
- Portfólio: [elenimar1.github.io](https://elenimar1.github.io/)
`;
}

async function main() {
  const response = await fetch(CV_URL);
  if (!response.ok) {
    throw new Error(`Falha ao baixar CV: ${response.status} ${response.statusText}`);
  }

  const html = await response.text();
  const cv = parseCv(html);

  if (!cv.email || !cv.phone || cv.projects.length < 4) {
    throw new Error("Dados essenciais ausentes ao interpretar o CV.");
  }

  await Promise.all([
    BunCompat.writeFile("index.html", renderIndex(cv)),
    BunCompat.writeFile("README.md", renderReadme(cv)),
    BunCompat.writeFile("github-profile-readme.md", renderProfileReadme(cv)),
  ]);
}

const BunCompat = {
  async writeFile(path, contents) {
    const { writeFile } = await import("node:fs/promises");
    await writeFile(path, contents, "utf8");
  },
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
