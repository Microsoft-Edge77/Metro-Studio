"use strict";

window.MetroScratchEngine = (() => {

    const VERSION = "0.1.0";
    const MAX_FILE_SIZE = 100 * 1024 * 1024;

    let currentProject = null;

    function createEmptyTarget() {
        return {
            isStage: true,
            name: "Stage",
            variables: {},
            lists: {},
            broadcasts: {},
            blocks: {},
            comments: {},
            currentCostume: 0,
            costumes: [],
            sounds: [],
            volume: 100,
            layerOrder: 0,
            tempo: 60,
            videoTransparency: 50,
            videoState: "on",
            textToSpeechLanguage: null
        };
    }

    function createProject(name = "Nouveau projet") {
        currentProject = {
            name,
            data: {
                targets: [createEmptyTarget()],
                monitors: [],
                extensions: [],
                meta: {
                    semver: "3.0.0",
                    vm: VERSION,
                    agent: "Metro Studio"
                }
            },
            originalFile: null,
            imported: false
        };

        return getProjectInfo();
    }

    function validateProject(data) {
        if (!data || typeof data !== "object") {
            throw new Error("Le fichier ne contient pas de projet valide.");
        }

        if (!Array.isArray(data.targets) || data.targets.length === 0) {
            throw new Error("Le projet ne contient aucune cible valide.");
        }

        const stage = data.targets.find(target => target.isStage);

        if (!stage) {
            throw new Error("La scène principale est absente.");
        }

        for (const target of data.targets) {
            if (
                !target ||
                typeof target.name !== "string" ||
                !Array.isArray(target.costumes) ||
                !Array.isArray(target.sounds) ||
                typeof target.blocks !== "object" ||
                !target.blocks
            ) {
                throw new Error("Structure de cible SB3 invalide.");
            }
        }

        return true;
    }

    async function importProject(file) {
        if (!file) {
            throw new Error("Aucun fichier sélectionné.");
        }

        if (file.size > MAX_FILE_SIZE) {
            throw new Error("Le fichier dépasse la limite de 100 Mo.");
        }

        if (!file.name.toLowerCase().endsWith(".sb3")) {
            throw new Error("Format incorrect. Sélectionnez un fichier .sb3.");
        }

        if (typeof JSZip === "undefined") {
            throw new Error("La bibliothèque JSZip est indisponible.");
        }

        let zip;

        try {
            zip = await JSZip.loadAsync(file);
        } catch {
            throw new Error("Impossible de lire l'archive SB3.");
        }

        const projectEntry = zip.file("project.json");

        if (!projectEntry) {
            throw new Error("Le fichier project.json est absent.");
        }

        let data;

        try {
            data = JSON.parse(await projectEntry.async("string"));
        } catch {
            throw new Error("Le fichier project.json est invalide.");
        }

        validateProject(data);

        currentProject = {
            name: file.name.replace(/\.sb3$/i, ""),
            data,
            originalFile: file,
            imported: true
        };

        return getProjectInfo();
    }

    function getProjectInfo() {
        if (!currentProject) return null;

        const targets = currentProject.data.targets;

        const stage = targets.find(target => target.isStage);

        const sprites = targets.filter(target => !target.isStage);

        return {
            name: currentProject.name,
            imported: currentProject.imported,
            spriteCount: sprites.length,
            costumeCount: targets.reduce(
                (total, target) => total + target.costumes.length,
                0
            ),
            soundCount: targets.reduce(
                (total, target) => total + target.sounds.length,
                0
            ),
            stageName: stage?.name || "Stage",
            sprites: sprites.map(sprite => ({
                name: sprite.name,
                costumes: sprite.costumes.length,
                sounds: sprite.sounds.length
            })),
            extensions: currentProject.data.extensions || []
        };
    }

    function getProject() {
        return currentProject;
    }

    function setProjectName(name) {
        if (!currentProject) {
            throw new Error("Aucun projet ouvert.");
        }

        const cleanName = String(name).trim();

        if (!cleanName || cleanName.length > 100) {
            throw new Error("Nom de projet invalide.");
        }

        currentProject.name = cleanName;
        currentProject.originalFile = null;
        currentProject.imported = false;

        return cleanName;
    }

    async function exportProject() {
        if (!currentProject) {
            throw new Error("Aucun projet à exporter.");
        }

        if (currentProject.originalFile) {
            return currentProject.originalFile;
        }

        if (typeof JSZip === "undefined") {
            throw new Error("JSZip est indisponible.");
        }

        const zip = new JSZip();

        const json = JSON.stringify(currentProject.data);

        zip.file("project.json", json);

        return await zip.generateAsync({
            type: "blob",
            mimeType: "application/x.scratch.sb3",
            compression: "DEFLATE",
            compressionOptions: {
                level: 6
            }
        });
    }

    function getState() {
        return currentProject ? getProjectInfo() : null;
    }

    function closeProject() {
        currentProject = null;
    }

    return Object.freeze({
        VERSION,
        createProject,
        importProject,
        exportProject,
        getProject,
        getProjectInfo,
        getState,
        setProjectName,
        closeProject
    });

})();
