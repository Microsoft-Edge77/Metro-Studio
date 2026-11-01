"use strict";

(() => {

    const Engine = window.MetroScratchEngine;

    if (!Engine) {
        console.error("Metro Studio : moteur indisponible.");
        return;
    }

    const $ = selector => document.querySelector(selector);

    const $$ = selector => [...document.querySelectorAll(selector)];

    let activePage = "home";

    let currentProject = null;

    const STORAGE_KEY = "metro-studio-settings-v1";
    const PROJECTS_KEY = "metro-studio-projects-v1";

    /* =========================================
       NOTIFICATIONS
    ========================================= */

    function notify(message, type = "info") {
        const container = $("#toast-container");
        const toast = document.createElement("div");

        toast.className = "toast";

        if (type === "error" || type === "success") {
            toast.classList.add(type);
        }

        toast.textContent = message;

        container.appendChild(toast);

        window.setTimeout(() => {
            toast.remove();
        }, 3500);
    }

    /* =========================================
       NAVIGATION
    ========================================= */

    function navigate(page) {
        const target = document.getElementById("page-" + page);

        if (!target) return;

        activePage = page;

        $$(".page").forEach(element => {
            element.classList.toggle(
                "active",
                element === target
            );
        });

        $$(".nav-item").forEach(button => {
            button.classList.toggle(
                "active",
                button.dataset.page === page
            );
        });

        if (page === "projects") {
            renderProjects();
        }

        if (page === "home") {
            renderRecentProjects();
        }
    }

    $$("[data-page]").forEach(button => {
        button.addEventListener("click", () => {
            navigate(button.dataset.page);
        });
    });

    $$("[data-goto]").forEach(button => {
        button.addEventListener("click", () => {
            navigate(button.dataset.goto);
        });
    });

    $("#home-button").addEventListener("click", () => {
        navigate("home");
    });

    $("#settings-button").addEventListener("click", () => {
        navigate("settings");
    });

    /* =========================================
       GESTION DU PROJET
    ========================================= */

    function updateProjectInterface() {
        const name = currentProject?.name || "Nouveau projet";

        $("#project-title").textContent = name;
        $("#editor-project-name").textContent = name;

        $("#save-status").textContent = currentProject
            ? "● Modifications non enregistrées"
            : "● Aucun projet ouvert";

        renderSpriteList();
    }

    function createNewProject() {
        const project = Engine.createProject();

        currentProject = {
            ...project
        };

        updateProjectInterface();

        navigate("editor");

        notify("Nouveau projet créé.", "success");
    }

    function updateCurrentProject() {
        if (!Engine.getProject()) {
            notify("Créez ou importez d'abord un projet.", "error");
            return false;
        }

        currentProject = Engine.getProjectInfo();

        return true;
    }

    /* =========================================
       IMPORTATION SB3
    ========================================= */

    function openFilePicker() {
        $("#sb3-input").click();
    }

    async function handleImport(event) {
        const file = event.target.files?.[0];

        // Autorise la réimportation du même fichier.
        event.target.value = "";

        if (!file) return;

        try {
            const info = await Engine.importProject(file);

            currentProject = info;

            updateProjectInterface();

            navigate("editor");

            renderProjectSprites(info);

            notify(
                `Projet "${info.name}" importé. ${info.spriteCount} sprite(s).`,
                "success"
            );

        } catch (error) {
            console.error("Importation SB3 :", error);

            notify(
                error.message || "Erreur lors de l'importation.",
                "error"
            );
        }
    }

    $("#sb3-input").addEventListener("change", handleImport);

    $("#import-project").addEventListener("click", openFilePicker);
    $("#tile-open").addEventListener("click", openFilePicker);
    $("#editor-import").addEventListener("click", openFilePicker);
    $("#projects-import").addEventListener("click", openFilePicker);

    /* =========================================
       EXPORTATION SB3
    ========================================= */

    async function exportCurrentProject() {
        if (!updateCurrentProject()) return;

        try {
            const blob = await Engine.exportProject();

            const filename =
                currentProject.name
                    .replace(/[\\/:*?"<>|]/g, "_")
                    .trim() || "Metro-Project";

            const url = URL.createObjectURL(blob);

            const link = document.createElement("a");

            link.href = url;
            link.download = filename + ".sb3";

            document.body.appendChild(link);
            link.click();
            link.remove();

            window.setTimeout(() => {
                URL.revokeObjectURL(url);
            }, 1000);

            notify("Exportation SB3 terminée.", "success");

        } catch (error) {
            console.error("Exportation :", error);
            notify(error.message, "error");
        }
    }

    $("#editor-export").addEventListener("click", exportCurrentProject);

    /* =========================================
       SAUVEGARDE LOCALE
    ========================================= */

    function getSavedProjects() {
        try {
            const data = JSON.parse(
                localStorage.getItem(PROJECTS_KEY) || "[]"
            );

            return Array.isArray(data) ? data : [];

        } catch {
            return [];
        }
    }

    function saveProject() {
        if (!updateCurrentProject()) return;

        const projects = getSavedProjects();

        const entry = {
            name: currentProject.name,
            date: new Date().toISOString(),
            spriteCount: currentProject.spriteCount,
            imported: currentProject.imported
        };

        const filtered = projects.filter(
            project => project.name !== entry.name
        );

        filtered.unshift(entry);

        try {
            localStorage.setItem(
                PROJECTS_KEY,
                JSON.stringify(filtered.slice(0, 30))
            );

            $("#save-status").textContent = "● Informations sauvegardées";

            notify(
                "Informations du projet sauvegardées localement.",
                "success"
            );

            renderRecentProjects();

        } catch {
            notify("Impossible de sauvegarder les informations.", "error");
        }
    }

    $("#editor-save").addEventListener("click", saveProject);

    /* =========================================
       BIBLIOTHÈQUE DE PROJETS
    ========================================= */

    function renderRecentProjects() {
        const container = $("#recent-projects");

        const projects = getSavedProjects();

        if (!projects.length) {
            container.innerHTML = `
                <div class="empty-state">
                    <span class="empty-icon">▤</span>
                    <p>Aucun projet récent.</p>
                    <span>Créez ou importez votre premier projet.</span>
                </div>
            `;

            return;
        }

        container.replaceChildren();

        projects.slice(0, 4).forEach(project => {
            const card = document.createElement("div");

            card.className = "project-card";

            const title = document.createElement("h3");
            title.textContent = project.name;

            const date = document.createElement("p");
            date.textContent = new Date(project.date).toLocaleDateString();

            const button = document.createElement("button");
            button.textContent = "Ouvrir l'éditeur";

            button.addEventListener("click", () => {
                if (
                    Engine.getProject() &&
                    Engine.getProjectInfo().name === project.name
                ) {
                    navigate("editor");
                } else {
                    notify(
                        "Ce projet n'est pas chargé. Réimportez son fichier SB3.",
                        "error"
                    );
                }
            });

            card.append(title, date, button);

            container.appendChild(card);
        });
    }

    function renderProjects() {
        const container = $("#projects-list");

        const projects = getSavedProjects();

        container.replaceChildren();

        if (!projects.length) {
            const empty = document.createElement("div");

            empty.className = "empty-state";
            empty.textContent = "Votre bibliothèque est vide.";

            container.appendChild(empty);

            return;
        }

        projects.forEach(project => {
            const card = document.createElement("article");

            card.className = "project-card";

            const title = document.createElement("h3");
            title.textContent = project.name;

            const date = document.createElement("p");
            date.textContent =
                "Dernière sauvegarde : " +
                new Date(project.date).toLocaleString();

            const button = document.createElement("button");
            button.textContent = "Ouvrir";

            button.addEventListener("click", () => {
                if (
                    Engine.getProject() &&
                    Engine.getProjectInfo().name === project.name
                ) {
                    navigate("editor");
                } else {
                    notify(
                        "Le fichier SB3 original doit être réimporté.",
                        "error"
                    );
                }
            });

            card.append(title, date, button);

            container.appendChild(card);
        });
    }

    /* =========================================
       SPRITES
    ========================================= */

    function renderSpriteList() {
        const project = Engine.getProjectInfo();

        if (!project) {
            $("#sprite-list").textContent = "Aucun sprite chargé";
            return;
        }

        renderProjectSprites(project);
    }

    function renderProjectSprites(project) {
        const container = $("#sprite-list");

        container.replaceChildren();

        if (!project.sprites.length) {
            const empty = document.createElement("div");

            empty.className = "sprite-empty";
            empty.textContent = "Aucun sprite dans ce projet.";

            container.appendChild(empty);
            return;
        }

        project.sprites.forEach(sprite => {
            const item = document.createElement("div");

            item.className = "sprite-item";
            item.textContent = sprite.name;

            container.appendChild(item);
        });
    }

    $("#add-sprite").addEventListener("click", () => {
        notify(
            "L'ajout et l'édition des sprites seront intégrés avec le moteur Scratch.",
            "info"
        );
    });

    /* =========================================
       CATÉGORIES
    ========================================= */

    const categoryNames = {
        motion: "Mouvement",
        looks: "Apparence",
        sound: "Son",
        events: "Événements",
        control: "Contrôle",
        sensing: "Capteurs",
        operators: "Opérateurs",
        variables: "Variables"
    };

    $$(".category-button").forEach(button => {
        button.addEventListener("click", () => {

            $$(".category-button").forEach(item => {
                item.classList.remove("selected");
            });

            button.classList.add("selected");

            const name = categoryNames[button.dataset.category];

            $("#blocks-palette").replaceChildren();

            const message = document.createElement("div");

            message.className = "engine-placeholder";

            const heading = document.createElement("h3");
            heading.textContent = name;

            const description = document.createElement("p");
            description.textContent =
                "La palette de blocs Scratch sera connectée ici.";

            message.append(heading, description);

            $("#blocks-palette").appendChild(message);
        });
    });

    /* =========================================
       SCÈNE ET CONTRÔLES
    ========================================= */

    $("#green-flag").addEventListener("click", () => {
        if (!Engine.getProject()) {
            notify("Aucun projet ouvert.", "error");
            return;
        }

        notify(
            "L'exécution des scripts nécessite l'intégration de Scratch VM.",
            "info"
        );
    });

    $("#stop-project").addEventListener("click", () => {
        notify("Aucun moteur d'exécution actif.", "info");
    });

    $("#fullscreen-stage").addEventListener("click", async () => {
        const stage = $("#stage-container");

        try {
            if (!document.fullscreenElement) {
                await stage.requestFullscreen();
            } else {
                await document.exitFullscreen();
            }
        } catch {
            notify("Le plein écran n'est pas disponible.", "error");
        }
    });

    /* =========================================
       PARAMÈTRES
    ========================================= */

    function loadSettings() {
        let settings = {};

        try {
            settings = JSON.parse(
                localStorage.getItem(STORAGE_KEY) || "{}"
            );
        } catch {
            settings = {};
        }

        const accent = /^#[0-9a-f]{6}$/i.test(settings.accent || "")
            ? settings.accent
            : "#0078D7";

        document.documentElement.style.setProperty(
            "--accent",
            accent
        );

        $("#dark-mode").checked = settings.darkMode !== false;

        applyTheme(settings.darkMode !== false);

        $$(".accent-choice").forEach(button => {
            button.classList.toggle(
                "selected",
                button.dataset.color === accent
            );
        });
    }

    function saveSettings() {
        const settings = {
            accent: getComputedStyle(
                document.documentElement
            ).getPropertyValue("--accent").trim(),

            darkMode: $("#dark-mode").checked
        };

        localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify(settings)
        );
    }

    function applyTheme(dark) {
        if (dark) {
            document.documentElement.style.setProperty(
                "--background", "#171717"
            );

            document.documentElement.style.setProperty(
                "--surface", "#222222"
            );

            document.documentElement.style.setProperty(
                "--surface-2", "#2B2B2B"
            );

            document.documentElement.style.setProperty(
                "--surface-3", "#353535"
            );

            document.documentElement.style.setProperty(
                "--text", "#FFFFFF"
            );

        } else {
            document.documentElement.style.setProperty(
                "--background", "#F0F0F0"
            );

            document.documentElement.style.setProperty(
                "--surface", "#FFFFFF"
            );

            document.documentElement.style.setProperty(
                "--surface-2", "#E8E8E8"
            );

            document.documentElement.style.setProperty(
                "--surface-3", "#DDDDDD"
            );

            document.documentElement.style.setProperty(
                "--text", "#202020"
            );
        }
    }

    $$(".accent-choice").forEach(button => {
        button.addEventListener("click", () => {
            const color = button.dataset.color;

            document.documentElement.style.setProperty(
                "--accent",
                color
            );

            $$(".accent-choice").forEach(item => {
                item.classList.toggle(
                    "selected",
                    item === button
                );
            });

            saveSettings();
        });
    });

    $("#dark-mode").addEventListener("change", event => {
        applyTheme(event.target.checked);
        saveSettings();
    });

    /* =========================================
       BOUTONS DE CRÉATION
    ========================================= */

    $("#create-project").addEventListener(
        "click",
        createNewProject
    );

    $("#tile-new").addEventListener(
        "click",
        createNewProject
    );

    $("#projects-new").addEventListener(
        "click",
        createNewProject
    );

    /* =========================================
       INITIALISATION
    ========================================= */

    function initialize() {
        loadSettings();

        renderRecentProjects();
        renderProjects();

        updateProjectInterface();

        $("#engine-indicator").style.background = "#D6A344";

        $("#engine-status").textContent =
            "Moteur Scratch en préparation";

        console.log(
            `Metro Studio ${Engine.VERSION} initialisé.`
        );
    }

    initialize();

})();
