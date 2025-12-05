import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, BookOpen, User, Lock, Settings2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { automationConfigSchema, type AutomationConfig } from "@shared/schema";

interface ConfigurationPanelProps {
  onConfigChange: (config: AutomationConfig) => void;
  disabled?: boolean;
  defaultValues?: Partial<AutomationConfig>;
}

export function ConfigurationPanel({
  onConfigChange,
  disabled = false,
  defaultValues,
}: ConfigurationPanelProps) {
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<AutomationConfig>({
    resolver: zodResolver(automationConfigSchema),
    defaultValues: {
      ra: defaultValues?.ra || "",
      password: defaultValues?.password || "",
      bookSlug: defaultValues?.bookSlug || "",
      interval: defaultValues?.interval || 60,
    },
  });

  const handleFieldChange = () => {
    const values = form.getValues();
    const result = automationConfigSchema.safeParse(values);
    if (result.success) {
      onConfigChange(result.data);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-xl font-semibold">
          <Settings2 className="h-5 w-5" />
          Configuração
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form className="space-y-5">
            <FormField
              control={form.control}
              name="ra"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
                    RA (Registro do Aluno)
                  </FormLabel>
                  <FormControl>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        {...field}
                        type="text"
                        placeholder="00001152877136sp"
                        className="h-12 pl-10"
                        disabled={disabled}
                        onChange={(e) => {
                          field.onChange(e);
                          handleFieldChange();
                        }}
                        data-testid="input-ra"
                      />
                    </div>
                  </FormControl>
                  <FormDescription className="text-sm text-muted-foreground">
                    Formato: RA + dígito + estado (ex: 00001152877136sp)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
                    Senha
                  </FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        {...field}
                        type={showPassword ? "text" : "password"}
                        placeholder="Sua senha"
                        className="h-12 pl-10 pr-10"
                        disabled={disabled}
                        onChange={(e) => {
                          field.onChange(e);
                          handleFieldChange();
                        }}
                        data-testid="input-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        disabled={disabled}
                        data-testid="button-toggle-password"
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="bookSlug"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
                    Slug do Livro
                  </FormLabel>
                  <FormControl>
                    <div className="relative">
                      <BookOpen className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        {...field}
                        type="text"
                        placeholder="harry-potter-e-a-pedra-filosofal"
                        className="h-12 pl-10"
                        disabled={disabled}
                        onChange={(e) => {
                          field.onChange(e);
                          handleFieldChange();
                        }}
                        data-testid="input-book-slug"
                      />
                    </div>
                  </FormControl>
                  <FormDescription className="text-sm text-muted-foreground">
                    Ex: harry-potter-e-a-pedra-filosofal
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="interval"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between">
                    <FormLabel className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
                      Intervalo entre páginas
                    </FormLabel>
                    <span className="text-sm font-medium tabular-nums">
                      {field.value}s ({(field.value / 60).toFixed(1)} min)
                    </span>
                  </div>
                  <FormControl>
                    <Slider
                      value={[field.value]}
                      onValueChange={([value]) => {
                        field.onChange(value);
                        handleFieldChange();
                      }}
                      min={60}
                      max={300}
                      step={10}
                      disabled={disabled}
                      className="py-2"
                      data-testid="slider-interval"
                    />
                  </FormControl>
                  <FormDescription className="text-sm text-muted-foreground">
                    Tempo de espera entre cada página (1 - 5 minutos)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
