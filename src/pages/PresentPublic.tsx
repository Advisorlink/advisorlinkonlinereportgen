import { useEffect } from "react";
import InteractivePresentation from "@/components/interactive-presentation/InteractivePresentation";

export default function PresentPublic() {
  useEffect(() => {
    document.title = "Settled & Sound - Retirement Presentation";
  }, []);
  return <InteractivePresentation />;
}
