import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Copiar, hecho una sola vez para todo el proyecto: la misma implementación que
 * partners y developers, la que usa `CopyTicket` en `console.tsx`. En la consola
 * se copian IDs de workspace, códigos de recuperación y enlaces de invitación;
 * una sola implementación, con un solo timeout, en vez de una por pantalla.
 *
 * Cada fallo se traga a propósito. El valor está en pantalla y se puede
 * seleccionar en todos los casos, así que un portapapeles que el navegador
 * rechaza — un origen inseguro, una política de permisos, una ventana sin foco
 * — cuesta una comodidad, no el valor.
 *
 * Devuelve el flag de «recién copiado» y la función que copia, en ese orden.
 */
export function useCopy(resetAfter = 2000): [boolean, (value: string) => void] {
	const [copied, setCopied] = useState(false);
	const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

	// Desmontar a mitad de la cuenta atrás ponía antes estado en un componente
	// muerto: las filas en las que va esto se vuelven a pintar con cada refetch.
	useEffect(
		() => () => {
			if (timer.current) clearTimeout(timer.current);
		},
		[],
	);

	const copy = useCallback(
		(value: string) => {
			void navigator.clipboard?.writeText(value).then(
				() => {
					setCopied(true);
					if (timer.current) clearTimeout(timer.current);
					timer.current = setTimeout(() => setCopied(false), resetAfter);
				},
				() => {},
			);
		},
		[resetAfter],
	);

	return [copied, copy];
}
