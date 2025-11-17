import { useState, useEffect, useRef } from "react"
import { X, Send, MessageCircle, Paperclip, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { useAuthStore } from "@/stores/authStore"
import { wsClient } from "@/lib/websocket"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { apiRequest } from "@/lib/queryClient"
import { useToast } from "@/hooks/use-toast"
import { Link } from "wouter"
import type { SupportMessage } from "@shared/schema"
import { format } from "date-fns"
import { ru } from "date-fns/locale"

interface SupportChatWidgetProps {
  isOpen: boolean
  onClose: () => void
}

export function SupportChatWidget({ isOpen, onClose }: SupportChatWidgetProps) {
  const [message, setMessage] = useState("")
  const [hasAcceptedPrivacy, setHasAcceptedPrivacy] = useState(false)
  const [showPrivacyConsent, setShowPrivacyConsent] = useState(false)
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const user = useAuthStore((state) => state.user)

  // Check if user has already accepted privacy policy
  useEffect(() => {
    if (user?.id) {
      const privacyAccepted = localStorage.getItem(`privacy_accepted_${user.id}`)
      if (privacyAccepted === "true") {
        setHasAcceptedPrivacy(true)
        setShowPrivacyConsent(false)
      } else {
        setShowPrivacyConsent(true)
      }
    }
  }, [user?.id])

  // Fetch messages
  const { data: messages = [], isLoading } = useQuery<SupportMessage[]>({
    queryKey: ["/api/support/messages"],
    enabled: isOpen && hasAcceptedPrivacy,
  })

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (text: string) => {
      return apiRequest("POST", "/api/support/messages", {
        messageText: text,
      })
    },
    onSuccess: () => {
      setMessage("")
      queryClient.invalidateQueries({ queryKey: ["/api/support/messages"] })
    },
    onError: () => {
      toast({
        title: "Ошибка",
        description: "Не удалось отправить сообщение",
        variant: "destructive",
      })
    },
  })

  // Connect to WebSocket when chat is open
  useEffect(() => {
    if (isOpen && hasAcceptedPrivacy && user?.id) {
      wsClient.connect(user.id)

      const unsubscribe = wsClient.onMessage((msg) => {
        if (msg.type === "new_message") {
          queryClient.invalidateQueries({ queryKey: ["/api/support/messages"] })
        }
      })

      return () => {
        unsubscribe()
      }
    }
  }, [isOpen, hasAcceptedPrivacy, user?.id, queryClient])

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]')
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight
      }
    }
  }, [messages])

  const handleSendMessage = () => {
    if (!message.trim()) return
    sendMessageMutation.mutate(message)
  }

  const handleAcceptPrivacy = () => {
    if (!user?.id || !hasAcceptedPrivacy) return
    localStorage.setItem(`privacy_accepted_${user.id}`, "true")
    setShowPrivacyConsent(false)
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col w-[400px] h-[600px] bg-background border rounded-lg shadow-2xl" style={{ display: isOpen ? 'flex' : 'none' }}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-primary text-primary-foreground">
        <div className="flex items-center gap-2">
          <MessageCircle className="h-5 w-5" />
          <h3 className="font-semibold">Техническая поддержка</h3>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="h-8 w-8 text-primary-foreground hover:bg-primary-foreground/20"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Privacy Consent */}
      {showPrivacyConsent && (
        <div className="flex-1 p-6 flex flex-col items-center justify-center gap-4">
          <MessageCircle className="h-16 w-16 text-muted-foreground" />
          <h4 className="text-lg font-semibold text-center">
            Добро пожаловать в чат поддержки!
          </h4>
          <p className="text-sm text-muted-foreground text-center">
            Для начала общения необходимо ваше согласие на обработку персональных данных
          </p>
          <div className="flex items-start space-x-2">
            <Checkbox
              id="privacy-consent"
              checked={hasAcceptedPrivacy}
              onCheckedChange={(checked) => setHasAcceptedPrivacy(!!checked)}
            />
            <Label
              htmlFor="privacy-consent"
              className="text-sm font-normal leading-relaxed cursor-pointer"
            >
              Я согласен с{" "}
              <Link href="/privacy-policy" onClick={onClose}>
                <span className="text-primary underline hover:no-underline">
                  Политикой конфиденциальности
                </span>
              </Link>{" "}
              и даю согласие на обработку персональных данных
            </Label>
          </div>
          <Button
            onClick={handleAcceptPrivacy}
            disabled={!hasAcceptedPrivacy}
            className="w-full"
          >
            Начать общение
          </Button>
        </div>
      )}

      {/* Chat Content */}
      {!showPrivacyConsent && (
        <>
          {/* Messages Area */}
          <ScrollArea ref={scrollAreaRef} className="flex-1 p-4">
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                  <p className="mt-2 text-sm text-muted-foreground">Загрузка сообщений...</p>
                </div>
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-2">
                <MessageCircle className="h-12 w-12 text-muted-foreground" />
                <p className="text-sm text-muted-foreground text-center">
                  Начните диалог с нашей службой поддержки
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((msg: SupportMessage) => {
                  const isMyMessage = msg.senderId === user?.id
                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col gap-1 ${
                        isMyMessage ? "items-end" : "items-start"
                      }`}
                    >
                      <div
                        className={`max-w-[80%] rounded-lg px-3 py-2 ${
                          isMyMessage
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted"
                        }`}
                      >
                        <p className="text-sm whitespace-pre-wrap break-words">
                          {msg.messageText}
                        </p>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(msg.createdAt), "HH:mm", { locale: ru })}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </ScrollArea>

          {/* Input Area */}
          <div className="p-4 border-t">
            <div className="flex gap-2">
              <Textarea
                placeholder="Введите сообщение..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={handleKeyPress}
                rows={2}
                className="resize-none"
              />
              <Button
                onClick={handleSendMessage}
                disabled={!message.trim() || sendMessageMutation.isPending}
                size="icon"
                className="h-auto"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Нажмите Enter для отправки, Shift+Enter для новой строки
            </p>
          </div>
        </>
      )}
    </div>
  )
}
