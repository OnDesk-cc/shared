import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../ui/dialog";

/**
 * El envoltorio de cualquier formulario en diálogo: título, descripción y hueco.
 *
 * Deliberadamente tonto. No sabe nada del formulario que lleva dentro — ni
 * botones, ni envío, ni validación, ni estado de carga —; todo eso lo pone quien
 * lo usa como `children`. Lo único que estandariza es la cabecera y el ancho,
 * que es lo que hacía que el mismo diálogo se viera distinto en cada producto.
 *
 * `maxWidth` es una unión cerrada de tres valores y no un string libre a
 * propósito: son tres anchos, no infinitos, y una clase de Tailwind escrita a
 * mano en la llamada puede no existir en el CSS compilado.
 *
 * Esto es un `Dialog` normal, así que SÍ se cierra al pulsar fuera. Para algo
 * irreversible se usa `ConfirmDeleteModal`, que no.
 */
interface FormModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	title: string;
	description: string;
	maxWidth?: "sm:max-w-md" | "sm:max-w-lg" | "sm:max-w-xl";
	children: React.ReactNode;
}

export function FormModal({
	open,
	onOpenChange,
	title,
	description,
	maxWidth = "sm:max-w-md",
	children,
}: FormModalProps) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className={maxWidth}>
				<DialogHeader>
					<DialogTitle>{title}</DialogTitle>
					<DialogDescription>{description}</DialogDescription>
				</DialogHeader>
				{children}
			</DialogContent>
		</Dialog>
	);
}
