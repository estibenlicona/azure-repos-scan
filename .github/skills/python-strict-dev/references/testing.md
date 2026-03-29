# Pruebas Unitarias

## Filosofía

- Testear comportamiento, no implementación
- Usar fakes tipados en vez de `MagicMock` para compatibilidad con Pylance strict
- Los tests de dominio y aplicación NO tocan infraestructura real
- Cada test es independiente y determinista

## Estructura

```
tests/
├── conftest.py              # Fixtures compartidas
├── unit/
│   ├── test_models.py       # Tests de entidades y value objects
│   ├── test_use_cases.py    # Tests de casos de uso con fakes
│   └── test_services.py     # Tests de servicios de dominio
└── integration/
    ├── test_adapters.py     # Tests contra implementaciones reales
    └── test_api.py          # Tests de endpoints
```

## Patrones

### Fakes Tipados (en vez de MagicMock)

```python
from __future__ import annotations

from typing import final

from mi_app.domain.models import User, UserId
from mi_app.domain.ports import UserRepository


@final
class FakeUserRepository:
    """Implementación in-memory del port para tests."""

    def __init__(self, users: Sequence[User] | None = None) -> None:
        self._store: dict[UserId, User] = {}
        if users:
            for user in users:
                self._store[user.id] = user

    def find_by_id(self, user_id: UserId) -> User | None:
        return self._store.get(user_id)

    def save(self, user: User) -> None:
        self._store[user.id] = user

    # Helpers solo para tests
    @property
    def saved_users(self) -> list[User]:
        return list(self._store.values())
```

### Fixtures Tipadas

```python
# conftest.py
from __future__ import annotations

import pytest

from mi_app.domain.models import User, UserId


@pytest.fixture
def sample_user() -> User:
    return User(id=UserId("usr-001"), name="Test User", email="test@example.com")


@pytest.fixture
def user_repo() -> FakeUserRepository:
    return FakeUserRepository()
```

### Test con Arrange-Act-Assert

```python
from __future__ import annotations


class TestCreateUser:
    """Tests para el caso de uso CreateUser."""

    def test_creates_user_successfully(
        self,
        user_repo: FakeUserRepository,
    ) -> None:
        # Arrange
        use_case = CreateUser(repository=user_repo)
        command = CreateUserCommand(name="Alice", email="alice@example.com")

        # Act
        result = use_case.execute(command)

        # Assert
        assert result.name == "Alice"
        assert len(user_repo.saved_users) == 1

    def test_raises_on_duplicate_email(
        self,
        user_repo: FakeUserRepository,
        sample_user: User,
    ) -> None:
        # Arrange
        user_repo.save(sample_user)
        use_case = CreateUser(repository=user_repo)
        command = CreateUserCommand(name="Other", email=sample_user.email)

        # Act & Assert
        with pytest.raises(DuplicateEmailError):
            use_case.execute(command)
```

### Tests Parametrizados

```python
@pytest.mark.parametrize(
    ("input_value", "expected"),
    [
        ("valid@email.com", True),
        ("invalid", False),
        ("", False),
        ("a@b.c", True),
    ],
    ids=["valid_email", "no_at_sign", "empty", "minimal_valid"],
)
def test_email_validation(input_value: str, expected: bool) -> None:
    assert is_valid_email(input_value) == expected
```

## Ejecución

```bash
# Todos los tests
pytest

# Solo unitarios
pytest tests/unit/

# Con cobertura detallada
pytest --cov=src --cov-report=html

# Un archivo específico
pytest tests/unit/test_models.py -v
```

## Reglas

1. Todo test tiene tipo de retorno `-> None`
2. No usar `MagicMock` — crea fakes que satisfagan los Protocol/ABC
3. Nombres descriptivos: `test_<qué_hace>_<condición>`
4. Un assert lógico por test (múltiples asserts del mismo concepto están bien)
5. Los tests de dominio NUNCA importan de `infrastructure/`
