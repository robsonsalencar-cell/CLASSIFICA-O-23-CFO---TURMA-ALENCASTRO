import { Mail, MessageCircle, Phone } from "lucide-react";

// Créditos + contato do desenvolvedor. Para mudar um número/e-mail, edite
// só este objeto — todas as telas usam este componente.
const CONTATO_DESENVOLVEDOR = {
  whatsappExibicao: "(65) 9 9213-7893",
  whatsappLink: "https://wa.me/5565992137893",
  telefoneExibicao: "(65) 9 9938-9945",
  telefoneLink: "tel:+5565999389945",
  email: "robsonalencar@pm.mt.gov.br",
};

interface Props {
  align?: "center" | "right";
  className?: string;
}

export function CreditosContato({ align = "center", className = "" }: Props) {
  const c = CONTATO_DESENVOLVEDOR;
  const alinhamento = align === "right" ? "items-end text-right" : "items-center text-center";
  const justify = align === "right" ? "justify-end" : "justify-center";
  const link = "inline-flex items-center gap-1 hover:text-foreground hover:underline";
  return (
    <div className={`flex flex-col gap-1 text-xs text-muted-foreground ${alinhamento} ${className}`}>
      <span>Criado por CAD PM ALENCAR - 2025</span>
      <span className={`flex flex-wrap gap-x-3 gap-y-1 ${justify}`}>
        <a href={c.whatsappLink} target="_blank" rel="noopener noreferrer" className={link}>
          <MessageCircle className="h-3 w-3" />
          WhatsApp: {c.whatsappExibicao}
        </a>
        <a href={c.telefoneLink} className={link}>
          <Phone className="h-3 w-3" />
          Tel.: {c.telefoneExibicao}
        </a>
        <a href={`mailto:${c.email}`} className={link}>
          <Mail className="h-3 w-3" />
          {c.email}
        </a>
      </span>
    </div>
  );
}
