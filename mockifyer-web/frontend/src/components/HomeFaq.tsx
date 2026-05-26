import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { HOME_FAQ } from '@/lib/faq'

export default function HomeFaq() {
  return (
    <Card id="faq">
      <CardHeader>
        <CardTitle>Frequently Asked Questions</CardTitle>
        <CardDescription>
          Common questions about API mocking, recording, and how Mockifyer compares to other tools
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {HOME_FAQ.map((item) => (
          <div key={item.question} className="space-y-2">
            <h3 className="text-lg font-semibold text-foreground">{item.question}</h3>
            <p className="text-muted-foreground leading-relaxed">{item.answer}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
