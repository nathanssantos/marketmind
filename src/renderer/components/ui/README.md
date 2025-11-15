# UI Components

Componentes reutilizáveis baseados no Chakra UI v3 com configuração padrão consistente.

## Componentes Disponíveis

### Button

Botão com suporte a loading, variantes e tamanhos.

**Props padrão:**
- `size`: `md`
- `variant`: `solid`
- `colorPalette`: `gray`

**Uso:**
```tsx
import { Button } from '@/components/ui';

// Básico
<Button>Click me</Button>

// Com loading
<Button loading loadingText="Salvando...">Save</Button>

// Variantes
<Button variant="outline">Outline</Button>
<Button variant="ghost">Ghost</Button>
<Button variant="subtle">Subtle</Button>

// Tamanhos
<Button size="xs">Extra Small</Button>
<Button size="sm">Small</Button>
<Button size="md">Medium</Button>
<Button size="lg">Large</Button>

// Cores
<Button colorPalette="blue">Blue</Button>
<Button colorPalette="green">Green</Button>
<Button colorPalette="red">Red</Button>
```

### Input

Campo de entrada de texto com variantes e tamanhos.

**Props padrão:**
- `size`: `md`
- `variant`: `outline`

**Uso:**
```tsx
import { Input } from '@/components/ui';

// Básico
<Input placeholder="Digite algo..." />

// Variantes
<Input variant="outline" />
<Input variant="subtle" />
<Input variant="flushed" />

// Tamanhos
<Input size="xs" />
<Input size="sm" />
<Input size="md" />
<Input size="lg" />

// Com Field (label e helper text)
<Field label="Email" helperText="Nunca compartilharemos seu email">
  <Input type="email" placeholder="email@example.com" />
</Field>
```

### Tabs

Sistema de abas com variantes e indicador visual.

**Props padrão:**
- `variant`: `line`
- `size`: `md`

**Uso:**
```tsx
import { Tabs } from '@/components/ui';

<Tabs.Root defaultValue="tab1">
  <Tabs.List>
    <Tabs.Trigger value="tab1">Tab 1</Tabs.Trigger>
    <Tabs.Trigger value="tab2">Tab 2</Tabs.Trigger>
    <Tabs.Trigger value="tab3">Tab 3</Tabs.Trigger>
    <Tabs.Indicator />
  </Tabs.List>
  
  <Tabs.Content value="tab1">
    Conteúdo da Tab 1
  </Tabs.Content>
  <Tabs.Content value="tab2">
    Conteúdo da Tab 2
  </Tabs.Content>
  <Tabs.Content value="tab3">
    Conteúdo da Tab 3
  </Tabs.Content>
</Tabs.Root>

// Variantes
<Tabs.Root variant="enclosed">
<Tabs.Root variant="subtle">
<Tabs.Root variant="outline">
<Tabs.Root variant="plain">
```

### Select

Select customizado com busca, loading e suporte a seções.

**Props:**
- `value`: valor selecionado
- `options`: array de `SelectOption`
- `onChange`: callback quando valor muda
- `enableSearch`: habilita busca local
- `isLoading`: mostra spinner
- `onSearchChange`: busca dinâmica
- `sectionLabel`: label para primeira seção
- `noWrap`: impede quebra de linha no texto

**Uso:**
```tsx
import { Select, SelectOption } from '@/components/ui';

const options: SelectOption[] = [
  { value: 'btc', label: 'Bitcoin', description: 'BTC' },
  { value: 'eth', label: 'Ethereum', description: 'ETH' },
];

<Select
  value={selected}
  options={options}
  onChange={setSelected}
  placeholder="Selecione uma opção"
  enableSearch
/>

// Com busca dinâmica
<Select
  value={symbol}
  options={symbols}
  onChange={setSymbol}
  isLoading={loading}
  onSearchChange={handleSearch}
  sectionLabel="Popular"
/>
```

### Field

Wrapper para inputs com label, helper text e error text.

**Uso:**
```tsx
import { Field, Input } from '@/components/ui';

<Field label="Email" helperText="Digite seu email">
  <Input type="email" />
</Field>

<Field label="Senha" errorText="Senha muito curta" invalid>
  <Input type="password" />
</Field>
```

### Slider

Slider com label e valor.

**Uso:**
```tsx
import { Field, Slider } from '@/components/ui';

<Field label="Volume">
  <Slider value={[50]} onValueChange={({ value }) => setValue(value[0])} />
</Field>
```

### Dialog

Componente de diálogo/modal.

**Uso:**
```tsx
import { Dialog, Button } from '@/components/ui';

<Dialog.Root open={isOpen} onOpenChange={(e) => setIsOpen(e.open)}>
  <Dialog.Backdrop />
  <Dialog.Positioner>
    <Dialog.Content>
      <Dialog.Header>
        <Dialog.Title>Título do Dialog</Dialog.Title>
      </Dialog.Header>
      <Dialog.CloseTrigger />
      
      <Dialog.Body>
        Conteúdo do dialog aqui
      </Dialog.Body>
      
      <Dialog.Footer>
        <Dialog.ActionTrigger asChild>
          <Button variant="outline">Cancelar</Button>
        </Dialog.ActionTrigger>
        <Button colorPalette="blue">Salvar</Button>
      </Dialog.Footer>
    </Dialog.Content>
  </Dialog.Positioner>
</Dialog.Root>
```

**Props padrão:**
- `Dialog.Root`: `placement="center"`
- `Dialog.Header`: `px={6}`, `py={4}`
- `Dialog.Body`: `px={6}`, `py={4}`
- `Dialog.Footer`: `px={6}`, `py={4}`

## Estilos Padrão

Todos os componentes usam o `defaultConfig` do Chakra UI v3, que já inclui:

- ✅ **Padding padrão** em buttons e inputs
- ✅ **Espaçamento consistente** 
- ✅ **Acessibilidade** (ARIA, keyboard navigation)
- ✅ **Dark mode** automático
- ✅ **Responsive** por padrão

## Theme

O tema customizado (`src/renderer/theme/index.ts`) adiciona apenas:

- Semantic tokens de cores (`bg.panel`, `bg.surface`, `border`, `fg`, etc)
- Global CSS mínimo (body background e user-select)

Tudo o resto vem do `defaultConfig` do Chakra UI v3.

## Chakra UI v3

**Documentação oficial:**
- [Button](https://www.chakra-ui.com/docs/components/button)
- [Input](https://www.chakra-ui.com/docs/components/input)
- [Tabs](https://www.chakra-ui.com/docs/components/tabs)
- [Field](https://www.chakra-ui.com/docs/components/field)
- [Slider](https://www.chakra-ui.com/docs/components/slider)
