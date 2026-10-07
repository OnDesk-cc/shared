// Pruebas de las piezas puras de la hoja de Nova central: `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { chatErrorText, classifyHistoryStatus, conversationKey, messageText } from "./nova-chat-parts.ts";

test("el estado de get-messages decide qué hacer", () => {
	assert.equal(classifyHistoryStatus(200), "ok");
	// Sesión caducada: decírselo a la persona, no vaciar el historial en silencio.
	assert.equal(classifyHistoryStatus(401), "expired");
	// La conversación guardada es de otra persona u otro workspace: empezar otra.
	assert.equal(classifyHistoryStatus(403), "foreign");
	assert.equal(classifyHistoryStatus(404), "foreign");
	assert.equal(classifyHistoryStatus(502), "error");
});

test("los errores conocidos del chat se dicen en una frase", () => {
	assert.match(chatErrorText("WebSocket closed mid-stream.") ?? "", /connection to Nova dropped/i);
	assert.match(chatErrorText("You're asking Nova too fast. Wait a minute and try again.") ?? "", /too fast/);
	assert.match(chatErrorText("Your session expired. Reload the page to keep talking to Nova.") ?? "", /session expired/i);
	// Lo interno (nombres de producto, dueños, errores del modelo) no llega tal cual.
	assert.equal(chatErrorText("This conversation has no owner"), null);
	assert.equal(chatErrorText("Unknown product"), null);
});

test("messageText une sólo las partes de texto", () => {
	const message = {
		id: "m1",
		role: "assistant" as const,
		parts: [
			{ type: "step-start" },
			{ type: "tool-orbit__search_tasks", toolCallId: "t", state: "output-available", input: {}, output: {} },
			{ type: "text", text: "Hay " },
			{ type: "text", text: "3 tareas." },
		],
	};
	assert.equal(messageText(message as never), "Hay 3 tareas.");
});

test("conversationKey separa producto y workspace", () => {
	assert.equal(conversationKey("orbit", "ws_1"), "nova:conversation:orbit:ws_1");
	assert.notEqual(conversationKey("orbit", "ws_1"), conversationKey("vault", "ws_1"));
});
