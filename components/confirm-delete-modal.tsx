import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "../ui/alert-dialog";

/**
 * «¿Seguro?» antes de un borrado, igual en los seis productos.
 *
 * Es un `AlertDialog` y no un `Dialog`: el de alerta atrapa el foco y no se
 * cierra al pulsar fuera, que es lo que se quiere delante de algo irreversible.
 * Quien lo usa pasa el texto; el botón rojo y el «Cancel» los pone este
 * componente, para que no haya un producto donde el destructivo esté a la
 * izquierda.
 *
 * Confirmar llama a `onConfirm()` y CIERRA el diálogo acto seguido, sin esperar
 * a que la mutación termine. Así que aquí dentro no hay estado de carga: si el
 * borrado falla, lo cuenta un toast con el diálogo ya cerrado.
 *
 * `description` es `ReactNode` y no `string` porque casi todas las llamadas
 * meten el nombre de lo que se va a borrar en negrita dentro de la frase.
 */
interface ConfirmDeleteModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	title: string;
	description: React.ReactNode;
	confirmLabel: string;
	onConfirm: () => void;
}

export function ConfirmDeleteModal({
	open,
	onOpenChange,
	title,
	description,
	confirmLabel,
	onConfirm,
}: ConfirmDeleteModalProps) {
	return (
		<AlertDialog open={open} onOpenChange={onOpenChange}>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>{title}</AlertDialogTitle>
					<AlertDialogDescription>{description}</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel className="text-xs">Cancel</AlertDialogCancel>
					<AlertDialogAction
						onClick={() => {
							onConfirm();
							onOpenChange(false);
						}}
						className="bg-destructive text-destructive-foreground hover:bg-destructive/90 text-xs">
						{confirmLabel}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
