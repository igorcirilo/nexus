import LegalPage, { Section } from '@/components/LegalPage'

export const metadata = { title: 'Termos de Uso — NEXUS' }

const ENTIDADE = '[NOME / ENTIDADE RESPONSÁVEL]'
const CONTATO = '[email de contacto]'
const FORO = '[comarca / país de foro]'
const IDADE = '[18]'

export default function TermosPage() {
  return (
    <LegalPage title="Termos de Uso" updatedAt="28 de junho de 2026">
      <p>
        Ao criar uma conta e usar o NEXUS, concordas com estes Termos. Se não
        concordares, não uses o app. O serviço é prestado por {ENTIDADE}
        (contacto: {CONTATO}).
      </p>

      <Section n={1} title="O serviço">
        <p>
          O NEXUS é uma ferramenta de organização e acompanhamento pessoal
          (hábitos, corpo, finanças pessoais, leitura e objetivos). Encontra-se
          em fase <b>beta</b>: pode conter erros, mudar ou ficar temporariamente
          indisponível, e funcionalidades podem ser alteradas ou removidas.
        </p>
      </Section>

      <Section n={2} title="Elegibilidade">
        <p>Precisas de ter, no mínimo, {IDADE} anos para usar o app.</p>
      </Section>

      <Section n={3} title="A tua conta">
        <p>
          És responsável por manter a confidencialidade das tuas credenciais e
          por toda a atividade na tua conta. Fornece informação verdadeira e
          mantém-na atualizada.
        </p>
      </Section>

      <Section n={4} title="Conteúdo que introduzes">
        <p>
          Os dados e ficheiros que registas ou importas continuam a ser teus.
          Garantes que tens o direito de os usar (por exemplo, extratos ou textos
          que carregas) e que não violam direitos de terceiros nem a lei.
          Concedes-nos apenas a permissão técnica necessária para armazenar e
          mostrar esse conteúdo a ti.
        </p>
      </Section>

      <Section n={5} title="Uso aceitável">
        <p>Não podes: usar o app para fins ilícitos, tentar aceder a dados de
          outros utilizadores, sobrecarregar ou comprometer a segurança do
          serviço, ou fazer engenharia inversa para fins indevidos.</p>
      </Section>

      <Section n={6} title="Não é aconselhamento profissional">
        <p>
          O NEXUS tem fins informativos e de organização pessoal. <b>Não constitui
          aconselhamento médico, nutricional, de treino, psicológico, financeiro
          ou de investimento.</b> Os planos, sugestões, metas e análises geradas
          (incluindo orçamentos, planos de treino/dieta e mensagens do &quot;Mentor&quot;)
          são apoios automáticos e não substituem um profissional qualificado.
          Consulta sempre um especialista antes de decisões de saúde ou
          financeiras. Usas estas informações por tua conta e risco.
        </p>
      </Section>

      <Section n={7} title="Limitação de responsabilidade">
        <p>
          O serviço é fornecido &quot;tal como está&quot;, sem garantias. Na medida máxima
          permitida por lei, {ENTIDADE} não é responsável por perdas indiretas,
          perda de dados, lucros cessantes ou danos resultantes do uso ou da
          impossibilidade de uso do app. Recomendamos que mantenhas as tuas
          próprias cópias dos dados importantes (vê &quot;Exportar os meus dados&quot;).
        </p>
      </Section>

      <Section n={8} title="Cancelamento">
        <p>
          Podes apagar a tua conta a qualquer momento em Perfil → &quot;Apagar a minha
          conta&quot;. Podemos suspender ou encerrar contas que violem estes Termos.
        </p>
      </Section>

      <Section n={9} title="Privacidade">
        <p>O tratamento dos teus dados é descrito na Política de Privacidade, que faz parte integrante destes Termos.</p>
      </Section>

      <Section n={10} title="Lei aplicável e foro">
        <p>
          Estes Termos regem-se pela lei de {FORO}, sendo eleito esse foro para
          dirimir litígios, sem prejuízo dos direitos do consumidor previstos na
          lei aplicável.
        </p>
      </Section>

      <Section n={11} title="Alterações">
        <p>
          Podemos atualizar estes Termos. Alterações relevantes serão comunicadas
          no app; o uso continuado após a atualização significa aceitação.
        </p>
      </Section>
    </LegalPage>
  )
}
