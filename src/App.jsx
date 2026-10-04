import { useCallback, useEffect, useState } from 'react';
import { api, clearTokens, getAccessToken, getApiError, getRefreshToken, saveTokens } from './api.js';

const emptyProduct = {
  product_name: '',
  description: '',
  price: '',
  quantity: '',
};

function Login({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { data } = await api.post('/api/auth/login', { username, password });
      saveTokens(data);
      onLogin(data.user?.username || username);
    } catch (requestError) {
      setError(getApiError(requestError, 'Unable to sign in.'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-layout">
      <section className="login-card">
        <div className="brand-mark" aria-hidden="true">S</div>
        <p className="eyebrow">STOCKROOM / INVENTORY</p>
        <h1>Good to see you.</h1>
        <p className="muted">Sign in to manage your products.</p>

        <form className="login-form" onSubmit={handleSubmit}>
          <label>
            Username
            <input
              autoComplete="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              required
            />
          </label>
          <label>
            Password
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>
          {error && <p className="alert" role="alert">{error}</p>}
          <button className="button button-primary button-wide" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <p className="login-note">Use your existing LavaLust account credentials.</p>
      </section>
    </main>
  );
}

function ProductForm({ product, onCancel, onSave, loading }) {
  const [form, setForm] = useState(product || emptyProduct);

  function updateField(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  function handleSubmit(event) {
    event.preventDefault();
    onSave({
      product_name: form.product_name.trim(),
      description: form.description,
      price: Number(form.price),
      quantity: Number(form.quantity),
    });
  }

  return (
    <form className="product-form" onSubmit={handleSubmit}>
      <div className="form-heading">
        <div>
          <p className="eyebrow">{product ? 'UPDATE ITEM' : 'NEW ITEM'}</p>
          <h2>{product ? 'Edit product' : 'Add a product'}</h2>
        </div>
      </div>
      <label>
        Product name
        <input
          name="product_name"
          maxLength="100"
          value={form.product_name}
          onChange={updateField}
          required
        />
      </label>
      <label>
        Description <span className="optional">(optional)</span>
        <textarea
          name="description"
          rows="3"
          value={form.description || ''}
          onChange={updateField}
        />
      </label>
      <div className="form-row">
        <label>
          Price
          <input
            name="price"
            type="number"
            min="0"
            step="0.01"
            value={form.price}
            onChange={updateField}
            required
          />
        </label>
        <label>
          Quantity
          <input
            name="quantity"
            type="number"
            min="0"
            step="1"
            value={form.quantity}
            onChange={updateField}
            required
          />
        </label>
      </div>
      <div className="form-actions">
        <button className="button button-quiet" type="button" onClick={onCancel} disabled={loading}>
          Cancel
        </button>
        <button className="button button-primary" disabled={loading}>
          {loading ? 'Saving…' : product ? 'Save changes' : 'Add product'}
        </button>
      </div>
    </form>
  );
}

function App() {
  const [authenticated, setAuthenticated] = useState(
    () => Boolean(getAccessToken() || getRefreshToken()),
  );
  const [username, setUsername] = useState('');
  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadProducts = useCallback(async () => {
    setLoadingProducts(true);
    setError('');

    try {
      const { data } = await api.get('/api/products');
      setProducts(Array.isArray(data.data) ? data.data : []);
    } catch (requestError) {
      setError(getApiError(requestError, 'Unable to load products.'));
    } finally {
      setLoadingProducts(false);
    }
  }, []);

  useEffect(() => {
    function handleExpiredSession() {
      setAuthenticated(false);
      setProducts([]);
      setError('Your session has expired. Please sign in again.');
    }

    window.addEventListener('auth:expired', handleExpiredSession);
    return () => window.removeEventListener('auth:expired', handleExpiredSession);
  }, []);

  useEffect(() => {
    if (authenticated) {
      loadProducts();
    }
  }, [authenticated, loadProducts]);

  async function handleSave(productData) {
    setSaving(true);
    setError('');
    setNotice('');

    try {
      if (editingProduct) {
        await api.put(`/api/products/${editingProduct.id}`, productData);
        setNotice('Product updated.');
      } else {
        await api.post('/api/products', productData);
        setNotice('Product added.');
      }

      setShowForm(false);
      setEditingProduct(null);
      await loadProducts();
    } catch (requestError) {
      setError(getApiError(requestError, 'Unable to save this product.'));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(product) {
    if (!window.confirm(`Delete "${product.product_name}"? This cannot be undone.`)) {
      return;
    }

    setError('');
    setNotice('');

    try {
      await api.delete(`/api/products/${product.id}`);
      setNotice('Product deleted.');
      await loadProducts();
    } catch (requestError) {
      setError(getApiError(requestError, 'Unable to delete this product.'));
    }
  }

  async function handleLogout() {
    setError('');
    setNotice('');

    try {
      await api.post('/api/auth/logout', { refresh_token: getRefreshToken() });
    } catch (requestError) {
      setError(getApiError(requestError, 'Unable to contact the API to log out.'));
    } finally {
      clearTokens();
      setAuthenticated(false);
      setUsername('');
      setProducts([]);
      setShowForm(false);
      setEditingProduct(null);
    }
  }

  function beginAdd() {
    setEditingProduct(null);
    setShowForm(true);
    setError('');
    setNotice('');
  }

  function beginEdit(product) {
    setEditingProduct({
      ...product,
      price: String(product.price),
      quantity: String(product.quantity),
    });
    setShowForm(true);
    setError('');
    setNotice('');
  }

  if (!authenticated) {
    return (
      <Login
        onLogin={(loggedInUsername) => {
          setUsername(loggedInUsername);
          setAuthenticated(true);
          setError('');
        }}
      />
    );
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="wordmark" href="/" aria-label="Stockroom home">
          <span className="brand-mark brand-mark-small" aria-hidden="true">S</span>
          <span>stockroom<span className="wordmark-dot">.</span></span>
        </a>
        <div className="account">
          <span className="account-name">{username || 'Signed in'}</span>
          <button className="button button-quiet button-small" onClick={handleLogout}>Log out</button>
        </div>
      </header>

      <section className="content">
        <div className="page-heading">
          <div>
            <p className="eyebrow">YOUR CATALOG</p>
            <h1>Products</h1>
            <p className="muted">Keep track of what’s in stock.</p>
          </div>
          <button className="button button-primary" onClick={beginAdd}>
            <span aria-hidden="true">＋</span> Add product
          </button>
        </div>

        {error && <p className="alert page-alert" role="alert">{error}</p>}
        {notice && <p className="success page-alert" role="status">{notice}</p>}

        {showForm && (
          <ProductForm
            key={editingProduct?.id || 'new'}
            product={editingProduct}
            onCancel={() => {
              setShowForm(false);
              setEditingProduct(null);
            }}
            onSave={handleSave}
            loading={saving}
          />
        )}

        <section className="catalog-card" aria-label="Product list">
          <div className="catalog-heading">
            <div>
              <h2>All products</h2>
              {!loadingProducts && <span className="item-count">{products.length} items</span>}
            </div>
            <button
              className="button button-quiet button-small"
              onClick={loadProducts}
              disabled={loadingProducts}
            >
              Refresh
            </button>
          </div>

          {loadingProducts ? (
            <div className="loading-state" role="status">
              <span className="spinner" aria-hidden="true" />
              <span>Loading products…</span>
            </div>
          ) : products.length === 0 ? (
            <div className="empty-state">
              <span className="empty-icon" aria-hidden="true">□</span>
              <h3>No products yet</h3>
              <p>Add your first product to get your catalog started.</p>
              <button className="button button-primary" onClick={beginAdd}>Add a product</button>
            </div>
          ) : (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Price</th>
                    <th>Quantity</th>
                    <th>Created</th>
                    <th><span className="visually-hidden">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((product) => (
                    <tr key={product.id}>
                      <td>
                        <span className="product-name">{product.product_name}</span>
                        <span className="product-description">
                          {product.description || 'No description'}
                        </span>
                      </td>
                      <td className="numeric">
                        {Number(product.price).toLocaleString('en-PH', {
                          style: 'currency',
                          currency: 'PHP',
                        })}
                      </td>
                      <td><span className="quantity-pill">{product.quantity}</span></td>
                      <td className="date-cell">
                        {product.created_at
                          ? new Date(product.created_at).toLocaleDateString()
                          : '—'}
                      </td>
                      <td>
                        <div className="row-actions">
                          <button
                            className="text-button"
                            onClick={() => beginEdit(product)}
                            aria-label={`Edit ${product.product_name}`}
                          >
                            Edit
                          </button>
                          <button
                            className="text-button danger-text"
                            onClick={() => handleDelete(product)}
                            aria-label={`Delete ${product.product_name}`}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
        <footer className="footer-note">PRODUCT MANAGEMENT <span>·</span> CONNECTED TO LAVALUST API</footer>
      </section>
    </main>
  );
}

export default App;
