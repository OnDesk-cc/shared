// El texto de un error del servidor en el idioma de quien lee: `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { translateServerError } from "./server-error";

const en = {
	folderNotFound: "Folder not found",
	nameTooLong: "A name may be at most {max} characters",
	fileTooLarge: "That file is larger than the {max} MB limit",
	planLimit: "Your plan allows {limit} spaces",
};
const es = {
	folderNotFound: "No se encontró la carpeta",
	nameTooLong: "Un nombre puede tener como máximo {max} caracteres",
	fileTooLarge: "Ese archivo supera el límite de {max} MB",
	planLimit: "Tu plan permite {limit} espacios",
};

test("un mensaje literal conocido sale traducido", () => {
	assert.equal(translateServerError({ error: "Folder not found" }, en, es), "No se encontró la carpeta");
});

test("un mensaje con valores se reconoce por su plantilla y conserva los valores", () => {
	assert.equal(translateServerError({ error: "A name may be at most 60 characters" }, en, es), "Un nombre puede tener como máximo 60 caracteres");
	assert.equal(translateServerError({ error: "That file is larger than the 2048 MB limit" }, en, es), "Ese archivo supera el límite de 2048 MB");
});

test("un code gana al texto, con sus params", () => {
	assert.equal(translateServerError({ error: "whatever", code: "planLimit", params: { limit: 3 } }, en, es), "Tu plan permite 3 espacios");
});

test("un mensaje desconocido se queda tal cual; sin mensaje, el respaldo", () => {
	assert.equal(translateServerError({ error: "Mirror fetch failed (502)" }, en, es), "Mirror fetch failed (502)");
	assert.equal(translateServerError({}, en, es, "Algo salió mal."), "Algo salió mal.");
	assert.equal(translateServerError(null, en, es, "Algo salió mal."), "Algo salió mal.");
});

test("los caracteres especiales del texto inglés no rompen la plantilla", () => {
	const en2 = { q: "Is it (really) {n}? Yes." };
	const pt2 = { q: "É (mesmo) {n}? Sim." };
	assert.equal(translateServerError({ error: "Is it (really) 5? Yes." }, en2, pt2), "É (mesmo) 5? Sim.");
});

test("con el diccionario inglés como local devuelve el mismo texto", () => {
	assert.equal(translateServerError({ error: "A name may be at most 60 characters" }, en, en), "A name may be at most 60 characters");
});
