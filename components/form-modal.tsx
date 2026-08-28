import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../ui/dialog";

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
