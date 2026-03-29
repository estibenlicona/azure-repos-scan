# Tipado Estricto con Pylance

## Configuración de Pylance

El proyecto usa `typeCheckingMode = "strict"` en `pyproject.toml` bajo `[tool.pyright]`. Pylance/Pyright usa esta configuración automáticamente.

## Reglas Obligatorias

### Imports
```python
# SIEMPRE en la primera línea de cada archivo .py
from __future__ import annotations
```
Esto habilita la evaluación diferida de anotaciones (PEP 563) y permite usar `X | Y` en vez de `Union[X, Y]` en todas las versiones de Python 3.7+.

### Funciones y Métodos
```python
# ✅ Todo parámetro y retorno tipado
def calcular_precio(base: Decimal, descuento: float) -> Decimal:
    return base * Decimal(1 - descuento)

# ✅ Generadores tipados
def iterar_usuarios(repo: UserRepository) -> Iterator[User]:
    yield from repo.find_all()

# ✅ Async tipado
async def obtener_datos(client: HttpClient, url: str) -> ResponseData:
    return await client.get(url)
```

### Variables y Atributos
```python
# ✅ Anotar cuando el tipo no es obvio
resultado: list[ProcessedItem] = []
cache: dict[str, UserProfile] = {}

# ✅ ClassVar para atributos de clase
class Config:
    MAX_RETRIES: ClassVar[int] = 3
```

### Tipos Preferidos para Parámetros (Covarianza)
| En vez de | Usar | Cuándo |
|-----------|------|--------|
| `list[T]` | `Sequence[T]` | Parámetro de solo lectura |
| `dict[K, V]` | `Mapping[K, V]` | Parámetro de solo lectura |
| `set[T]` | `AbstractSet[T]` | Parámetro de solo lectura |
| `Callable` | `Callable[[Args], Ret]` | Siempre especificar firma |

### Tipos para Retorno (usar concretos)
Devolver el tipo concreto: `list[T]`, `dict[K, V]`, `set[T]`.

### Patrones Avanzados
```python
# TypeAlias para tipos complejos
type JsonValue = str | int | float | bool | None | list[JsonValue] | dict[str, JsonValue]

# TypeVar con bound
type T = TypeVar("T", bound=BaseModel)

# Literal para valores fijos
def set_mode(mode: Literal["dark", "light"]) -> None: ...

# TypeGuard para narrowing
def is_valid_user(data: dict[str, object]) -> TypeGuard[UserDict]: ...

# Overload para firmas múltiples
@overload
def get(key: str, default: None = None) -> str | None: ...
@overload
def get(key: str, default: str) -> str: ...
```

### Protocol vs ABC
```python
# Protocol: tipado estructural (duck typing con tipos)
# Usar cuando NO necesitas implementación base compartida
class Serializable(Protocol):
    def to_dict(self) -> dict[str, object]: ...

# ABC: tipado nominal con herencia
# Usar cuando hay lógica base compartida
class BaseRepository(ABC):
    def __init__(self, connection: Connection) -> None:
        self._conn = connection

    @abstractmethod
    def find_by_id(self, id: str) -> Entity | None: ...

    def health_check(self) -> bool:
        """Lógica compartida por todas las implementaciones."""
        return self._conn.is_alive()
```

## Validación con Pylance MCP

Si el MCP de Pylance está disponible en el entorno, usarlo para:
1. Obtener diagnósticos de un archivo: diagnostics del documento
2. Verificar hover/tipo de una expresión específica
3. Completar imports faltantes

Si no hay MCP de Pylance, usar la herramienta de errores del editor para validar cada archivo después de editarlo.

## Prohibiciones

- ❌ `Any` — solo en fronteras de integración con librerías sin tipos, documentado
- ❌ `# type: ignore` — solo si Pylance tiene un falso positivo comprobado, con comentario justificando
- ❌ `cast()` — solo cuando el narrowing no es posible de otra forma
- ❌ Variables sin tipo cuando el tipo no es inferible
- ❌ `**kwargs: Any` — usar `TypedDict` con `**kwargs: Unpack[MyKwargs]`
