import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import InteractivePresentation from "@/components/interactive-presentation/InteractivePresentation";

export default function PresentPublic() {
  const [params] = useSearchParams();
  const deck = params.get("deck") === "home-loan" ? "home-loan" : "super";
  useEffect(() => {
    document.title = deck === "home-loan"
      ? "Settled & Sound - Zero Deposit Home Loan Presentation"
      : "Settled & Sound - Retirement Presentation";
  }, [deck]);
  return <InteractivePresentation deck={deck} />;
}
