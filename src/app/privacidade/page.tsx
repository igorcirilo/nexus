import LegalPage, { Section } from '@/components/LegalPage'

export const metadata = { title: 'Política de Privacidade — NEXUS' }

// Preencher antes do lançamento:
const ENTIDADE = '[NOME / ENTIDADE RESPONSÁVEL]'
const CONTATO = '[email de contacto / DPO]'
const PAIS = '[Brasil / Portugal]'

export default function PrivacidadePage() {
  return (
    <LegalPage title="Política de Privacidade" updatedAt="28 de junho de 2026">
      <p>
        Esta política descreve como o NEXUS (&quot;app&quot;, &quot;nós&quot;) trata os teus dados
        pessoais. O responsável pelo tratamento (controlador) é {ENTIDADE}, que
        pode ser contactado em {CONTATO}. Aplica-se a legislação de proteção de
        dados de {PAIS} (LGPD e/ou GDPR, conforme aplicável).
      </p>

      <Section n={1} title="Que dados recolhemos">
        <p>Recolhemos apenas o necessário para o app funcionar:</p>
        <ul>
          <li><b>Conta:</b> nome e email (via autenticação).</li>
          <li><b>Saúde (dados sensíveis):</b> peso e medidas corporais, horas de
            sono, humor e energia que registas voluntariamente.</li>
          <li><b>Financeiros:</b> transações, categorias e orçamentos que
            introduzes ou importas (CSV/PDF). Os ficheiros importados são
            processados no teu dispositivo/sessão e não são partilhados.</li>
          <li><b>Atividade:</b> hábitos, check-ins, objetivos, leitura, agenda e
            lembretes.</li>
          <li><b>Técnicos:</b> preferências locais (tema) e, se ativares,
            subscrição de notificações push.</li>
        </ul>
        <p>Não usamos cookies de rastreamento nem ferramentas de analytics de terceiros.</p>
      </Section>

      <Section n={2} title="Para que usamos e com que base legal">
        <p>
          Usamos os dados exclusivamente para te prestar o serviço (mostrar o teu
          progresso, gráficos, lembretes e análises). A base legal é a
          <b> execução do serviço que solicitas</b> e o teu <b>consentimento</b>,
          recolhido no registo. Para os <b>dados de saúde</b> (categoria especial /
          sensível), pedimos um <b>consentimento específico</b>; podes revogá-lo a
          qualquer momento apagando esses dados ou a conta.
        </p>
      </Section>

      <Section n={3} title="Partilha e subprocessadores">
        <p>Não vendemos os teus dados. Recorremos a fornecedores que os tratam em nosso nome:</p>
        <ul>
          <li><b>Supabase</b> — base de dados, autenticação e armazenamento.</li>
          <li><b>Vercel</b> — alojamento da aplicação.</li>
          <li><b>Serviço de Web Push</b> do navegador — apenas se ativares notificações.</li>
        </ul>
        <p>
          Estes fornecedores podem processar dados fora do teu país; quando tal
          ocorre, é feito ao abrigo das salvaguardas legais aplicáveis. A região
          dos dados está configurada em [REGIÃO DO PROJETO SUPABASE].
        </p>
      </Section>

      <Section n={4} title="Por quanto tempo guardamos">
        <p>
          Guardamos os teus dados enquanto a conta existir. Quando usas
          &quot;Repor dados&quot; ou &quot;Apagar conta&quot;, os dados são removidos de imediato
          dos nossos sistemas (podendo persistir por um curto período em cópias
          de segurança técnicas antes de expirarem).
        </p>
      </Section>

      <Section n={5} title="Os teus direitos">
        <p>Tens direito a: aceder, corrigir, exportar e apagar os teus dados, e a revogar o consentimento. No app:</p>
        <ul>
          <li><b>Exportar:</b> Perfil → &quot;Exportar os meus dados&quot; (ficheiro JSON).</li>
          <li><b>Apagar dados:</b> Perfil → &quot;Repor todos os dados&quot;.</li>
          <li><b>Apagar a conta:</b> Perfil → &quot;Apagar a minha conta&quot;.</li>
        </ul>
        <p>Para qualquer pedido ou reclamação, contacta {CONTATO}.</p>
      </Section>

      <Section n={6} title="Segurança">
        <p>
          O acesso aos dados é isolado por utilizador (cada conta só acede aos
          seus dados, com Row Level Security) e a comunicação é cifrada em
          trânsito (HTTPS). Nenhum método é 100% infalível; em caso de incidente
          relevante, comunicaremos conforme exigido por lei.
        </p>
      </Section>

      <Section n={7} title="Idade mínima">
        <p>
          O NEXUS destina-se a maiores de [IDADE MÍNIMA, ex.: 18] anos. Não
          recolhemos intencionalmente dados de menores; se tomarmos conhecimento,
          apagamos a conta.
        </p>
      </Section>

      <Section n={8} title="Alterações">
        <p>
          Podemos atualizar esta política. Alterações relevantes serão
          comunicadas no app. O uso continuado após a atualização significa
          aceitação da versão revista.
        </p>
      </Section>
    </LegalPage>
  )
}
