
import { useEffect, useMemo, useState } from 'react';
import {
  Search,
  ShoppingBag,
  Heart,
  User,
  Star,
  X,
  Trash2,
  Plus,
  Minus,
  Menu,
  Gem,
  Loader2
} from 'lucide-react';

type Product = {
  id: number;
  name: string;
  category: string;
  metal: string;
  gemstone: string;
  price: number;
  image: string;
  description: string;
  stock: number;
};

const API_BASE = 'https://mpr-jwellery.onrender.com';

const demoProducts: Product[] = [
  {
    id: 1,
    name: 'Gold Necklace',
    category: 'Necklaces',
    metal: 'Gold',
    gemstone: 'None',
    price: 25999,
    image: 'https://images.unsplash.com/photo-1611591437281-460bfbe1220a?auto=format&fit=crop&w=800',
    description: 'Elegant gold necklace for celebrations.',
    stock: 5
  },
  {
    id: 2,
    name: 'Diamond Studs',
    category: 'Earrings',
    metal: 'Diamond',
    gemstone: 'Diamond',
    price: 18999,
    image: 'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?auto=format&fit=crop&w=800',
    description: 'Classic sparkling diamond earrings.',
    stock: 8
  },
  {
    id: 3,
    name: 'Silver Bracelet',
    category: 'Bracelets',
    metal: 'Silver',
    gemstone: 'None',
    price: 2999,
    image: 'https://images.unsplash.com/photo-1611652022419-a9419f74343d?auto=format&fit=crop&w=800',
    description: 'Beautiful polished silver bracelet.',
    stock: 12
  },
  {
    id: 4,
    name: 'Ruby Ring',
    category: 'Rings',
    metal: 'Gold',
    gemstone: 'Ruby',
    price: 12999,
    image: 'https://images.unsplash.com/photo-1605100804763-247f67b3557e?auto=format&fit=crop&w=800',
    description: 'Elegant ruby accent ring.',
    stock: 6
  },
  {
    id: 5,
    name: 'Pearl Pendant',
    category: 'Pendants',
    metal: 'Silver',
    gemstone: 'Pearl',
    price: 4999,
    image: 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=800',
    description: 'Beautiful pearl pendant.',
    stock: 10
  },
  {
    id: 6,
    name: 'Gold Earrings',
    category: 'Earrings',
    metal: 'Gold',
    gemstone: 'None',
    price: 8999,
    image: 'https://images.unsplash.com/photo-1630019852942-f89202989a59?auto=format&fit=crop&w=800',
    description: 'Traditional gold earrings.',
    stock: 7
  },
  {
    id: 7,
    name: 'Diamond Ring',
    category: 'Rings',
    metal: 'Diamond',
    gemstone: 'Diamond',
    price: 22999,
    image: 'https://images.unsplash.com/photo-1605100804763-247f67b3557e?auto=format&fit=crop&w=800',
    description: 'Beautiful diamond ring.',
    stock: 4
  },
  {
    id: 8,
    name: 'Silver Necklace',
    category: 'Necklaces',
    metal: 'Silver',
    gemstone: 'None',
    price: 5999,
    image: 'https://images.unsplash.com/photo-1611591437281-460bfbe1220a?auto=format&fit=crop&w=800',
    description: 'Stylish silver necklace.',
    stock: 9
  }
];

const formatPrice = (price: number) =>
  '₹' + Number(price || 0).toLocaleString('en-IN');

export default function App() {
  const [products, setProducts] = useState<Product[]>(demoProducts);
  const [search, setSearch] = useState('');
  const [metal, setMetal] = useState('All');
  const [sort, setSort] = useState('');
  const [cart, setCart] = useState<Product[]>([]);
  const [wishlist, setWishlist] = useState<number[]>([]);
  const [selected, setSelected] = useState<Product | null>(null);

  const [loginOpen, setLoginOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [token, setToken] = useState('');

  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [apiStatus, setApiStatus] = useState('Connecting');
  const [busy, setBusy] = useState(false);

  // Load products from Render backend
  useEffect(() => {
    let active = true;

    async function loadProducts() {
      try {
        const response = await fetch(`${API_BASE}/api/products`);

        if (!response.ok) {
          throw new Error('Product API unavailable');
        }

        const data = await response.json();

        const productList = Array.isArray(data)
          ? data
          : data.products;

        if (!Array.isArray(productList)) {
          throw new Error('Unexpected product response');
        }

        if (active) {
          setProducts(productList);
          setApiStatus('Connected');
        }
      } catch (error) {
        if (active) {
          setProducts(demoProducts);
          setApiStatus('Demo mode');
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadProducts();

    return () => {
      active = false;
    };
  }, []);

  // Search, filter and sort products
  const filteredProducts = useMemo(() => {
    let result = products.filter(product => {
      const matchesMetal =
        metal === 'All' ||
        product.metal?.toLowerCase() === metal.toLowerCase();

      const searchText = (
        product.name +
        product.category +
        product.gemstone +
        product.metal
      ).toLowerCase();

      return matchesMetal &&
        searchText.includes(search.toLowerCase());
    });

    if (sort === 'low') {
      result.sort((a, b) => a.price - b.price);
    }

    if (sort === 'high') {
      result.sort((a, b) => b.price - a.price);
    }

    return result;
  }, [products, search, metal, sort]);

  // Cart calculations
  const total = cart.reduce(
    (sum, product) => sum + product.price,
    0
  );

  function addToCart(product: Product) {
    setCart(previous => [...previous, product]);
    setMessage(`${product.name} added to cart`);
  }

  function removeFromCart(index: number) {
    setCart(previous =>
      previous.filter((_, i) => i !== index)
    );
  }

  function toggleWishlist(id: number) {
    setWishlist(previous =>
      previous.includes(id)
        ? previous.filter(item => item !== id)
        : [...previous, id]
    );
  }

  // Customer / owner login
  async function signIn() {
    if (!email || !password) {
      setMessage('Please enter email and password');
      return;
    }

    setBusy(true);

    try {
      const response = await fetch(
        `${API_BASE}/api/auth/login`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            email,
            password
          })
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Login failed');
      }

      if (!data.token) {
        throw new Error('Login response did not contain a token');
      }

      setToken(data.token);
      setLoginOpen(false);
      setPassword('');
      setMessage('Login successful!');
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Unable to login'
      );
    } finally {
      setBusy(false);
    }
  }

  // Place order
  async function placeOrder() {
    if (cart.length === 0) {
      setMessage('Your cart is empty');
      return;
    }

    if (!token) {
      setLoginOpen(true);
      setMessage('Please login before placing an order');
      return;
    }

    setBusy(true);

    try {
      const response = await fetch(
        `${API_BASE}/api/orders`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            items: cart,
            total
          })
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Order could not be placed');
      }

      setMessage(
        `Order #${data.orderId ?? data.id ?? 'created'} placed successfully`
      );

      setCart([]);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Unable to place order'
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900">

      {/* HEADER */}
      <header className="sticky top-0 z-20 bg-white shadow">

        <div className="gold text-center text-white p-2 text-xs tracking-widest">
          CRAFTED WITH CARE • CELEBRATE EVERY MOMENT
        </div>

        <nav className="max-w-7xl mx-auto flex flex-wrap gap-4 items-center p-4">

          <h1 className="text-2xl font-serif font-bold text-amber-800">
            MPR <span className="text-stone-800">JEWELLERY</span>
          </h1>

          <div className="flex flex-1 bg-stone-100 rounded-full p-2 min-w-48">
            <Search size={20} />

            <input
              className="bg-transparent outline-none w-full px-2"
              placeholder="Search jewellery..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          <button
            onClick={() => setLoginOpen(true)}
            className="flex items-center gap-1"
          >
            <User size={20} />
            Login
          </button>

          <button
            onClick={() =>
              setMessage(`Wishlist items: ${wishlist.length}`)
            }
            className="flex items-center gap-1"
          >
            <Heart size={20} />
            Wishlist ({wishlist.length})
          </button>

          <button
            onClick={() =>
              setMessage(`Cart items: ${cart.length}`)
            }
            className="flex items-center gap-1"
          >
            <ShoppingBag size={20} />
            ({cart.length})
          </button>

        </nav>

        <div className="flex justify-center flex-wrap gap-5 p-3 border-t">

          {['All', 'Gold', 'Silver', 'Diamond'].map(item => (
            <button
              key={item}
              onClick={() => setMetal(item)}
              className={
                metal === item
                  ? 'text-amber-800 font-bold'
                  : 'hover:text-amber-700'
              }
            >
              {item}
            </button>
          ))}

        </div>

      </header>

      {/* CONNECTION STATUS */}
      <div className="max-w-7xl mx-auto px-4 pt-3">
        <p className="text-xs text-stone-500">
          API status: {apiStatus}
        </p>
      </div>

      {/* MAIN CONTENT */}
      <main className="max-w-7xl mx-auto p-4">

        {/* HERO */}
        <section className="gold rounded-3xl text-white p-8 md:p-14 min-h-64">

          <p className="tracking-widest">
            MPR SIGNATURE COLLECTION
          </p>

          <h2 className="font-serif text-4xl md:text-6xl my-4">
            Jewellery that tells your story.
          </h2>

          <p>
            Tradition, elegance and sparkle for every occasion.
          </p>

          <button
            className="mt-5 rounded-full bg-white text-amber-900 px-5 py-3"
            onClick={() =>
              document.getElementById('shop')?.scrollIntoView({
                behavior: 'smooth'
              })
            }
          >
            Explore Collection
          </button>

        </section>

        {/* COLLECTIONS */}
        <section className="py-8">

          <h2 className="text-2xl font-serif text-center mb-4">
            Shop by collection
          </h2>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">

            {[
              ['Gold', 'Timeless classics'],
              ['Silver', 'Everyday elegance'],
              ['Diamond', 'Brilliant moments'],
              ['Gemstones', 'Colourful stories']
            ].map(([name, description]) => (

              <button
                key={name}
                onClick={() =>
                  setMetal(name === 'Gemstones' ? 'All' : name)
                }
                className="bg-white border border-amber-200 rounded-xl p-5 text-left hover:shadow-md"
              >
                <b className="text-amber-800 text-xl">
                  {name}
                </b>

                <p className="text-sm text-stone-500">
                  {description}
                </p>
              </button>

            ))}

          </div>

        </section>

        {/* PRODUCTS */}
        <section id="shop">

          <div className="flex flex-wrap justify-between items-center gap-3">

            <h2 className="font-serif text-2xl">
              Featured Jewellery
            </h2>

            <select
              className="border rounded-lg p-2 bg-white"
              value={sort}
              onChange={e => setSort(e.target.value)}
            >
              <option value="">Featured</option>
              <option value="low">Price: Low to high</option>
              <option value="high">Price: High to low</option>
            </select>

          </div>

          {loading && (
            <p className="text-center p-6">
              <Loader2 className="animate-spin inline mr-2" />
              Loading products...
            </p>
          )}

          {!loading && filteredProducts.length === 0 && (
            <p className="text-center p-8 text-stone-500">
              No jewellery found.
            </p>
          )}

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mt-4">

            {filteredProducts.map(product => (

              <article
                key={product.id}
                className="bg-white rounded-2xl overflow-hidden border hover:shadow-lg"
              >

                <button
                  className="w-full text-left"
                  onClick={() => setSelected(product)}
                >

                  <img
                    src={product.image}
                    alt={product.name}
                    className="aspect-square w-full object-cover"
                  />

                  <div className="p-3">

                    <b>{product.name}</b>

                    <p className="text-amber-800 font-bold">
                      {formatPrice(product.price)}
                    </p>

                    <small className="text-stone-500">
                      {product.metal} · {product.category}
                    </small>

                    <p className="text-amber-700 text-xs mt-2">
                      <Star size={12} className="inline" />
                      {' '}4.7 · Featured
                    </p>

                  </div>

                </button>

                <div className="flex p-3 gap-2">

                  <button
                    className="border rounded-lg p-2 flex-1 hover:bg-amber-50"
                    onClick={() => addToCart(product)}
                  >
                    Add to cart
                  </button>

                  <button
                    className="border rounded-lg p-2"
                    onClick={() => toggleWishlist(product.id)}
                  >
                    <Heart
                      size={20}
                      fill={
                        wishlist.includes(product.id)
                          ? 'currentColor'
                          : 'none'
                      }
                      className={
                        wishlist.includes(product.id)
                          ? 'text-red-600'
                          : ''
                      }
                    />
                  </button>

                </div>

              </article>

            ))}

          </div>

        </section>

        {/* BANNER */}
        <section className="bg-stone-900 text-white rounded-2xl p-8 mt-8">

          <Gem className="text-amber-300 mb-3" size={32} />

          <h2 className="font-serif text-2xl">
            A little luxury, made meaningful.
          </h2>

          <p className="text-stone-300 mt-2">
            Thoughtful designs. A celebration of craft. MPR Jewellery.
          </p>

        </section>

      </main>

      {/* FOOTER */}
      <footer className="bg-stone-950 text-white p-8 mt-8 grid grid-cols-2 md:grid-cols-4 gap-5">

        <div>
          <b className="text-amber-300">MPR Jewellery</b>
          <p>Crafted for every chapter.</p>
        </div>

        <div>
          <b>Shop</b>
          <p>Gold · Silver · Diamonds</p>
        </div>

        <div>
          <b>Customer care</b>
          <p>Orders · Returns · Support</p>
        </div>

        <div>
          <b>Payments</b>
          <p>Manual UPI payment confirmation pending.</p>
        </div>

      </footer>

      {/* PRODUCT DETAILS */}
      {selected && (

        <div
          className="fixed inset-0 bg-black/60 z-30 grid place-items-center p-4"
          onClick={() => setSelected(null)}
        >

          <div
            className="bg-white rounded-xl p-5 max-w-2xl w-full grid md:grid-cols-2 gap-4 max-h-[90vh] overflow-auto"
            onClick={e => e.stopPropagation()}
          >

            <img
              className="rounded-lg w-full object-cover"
              src={selected.image}
              alt={selected.name}
            />

            <div>

              <button
                className="float-right"
                onClick={() => setSelected(null)}
              >
                <X />
              </button>

              <h2 className="font-serif text-2xl">
                {selected.name}
              </h2>

              <p className="text-amber-800 text-xl font-bold mt-2">
                {formatPrice(selected.price)}
              </p>

              <p className="mt-3">
                {selected.description}
              </p>

              <p className="text-sm mt-3">
                Material: {selected.metal}
              </p>

              <p className="text-sm">
                Category: {selected.category}
              </p>

              <p className="text-sm">
                Gemstone: {selected.gemstone}
              </p>

              <p className="text-sm">
                Stock: {selected.stock}
              </p>

              <button
                className="bg-amber-800 text-white p-3 rounded-lg mt-5 w-full"
                onClick={() => addToCart(selected)}
              >
                Add to cart
              </button>

            </div>

          </div>

        </div>

      )}

      {/* SHOPPING CART */}
      {cart.length > 0 && (

        <aside className="fixed bottom-3 right-3 bg-white border shadow-xl rounded-xl p-4 z-20 w-[min(90vw,340px)]">

          <div className="flex justify-between items-center">

            <b>Shopping Cart ({cart.length})</b>

            <button onClick={() => setCart([])}>
              <Trash2 size={18} />
            </button>

          </div>

          <div className="max-h-40 overflow-auto mt-3">

            {cart.map((product, index) => (

              <div
                key={`${product.id}-${index}`}
                className="text-sm flex justify-between gap-2 py-2 border-b"
              >

                <span>{product.name}</span>

                <span className="whitespace-nowrap">
                  {formatPrice(product.price)}

                  <button
                    className="ml-2 text-red-600"
                    onClick={() => removeFromCart(index)}
                  >
                    <X size={14} className="inline" />
                  </button>
                </span>

              </div>

            ))}

          </div>

          <b className="block mt-3">
            Total: {formatPrice(total)}
          </b>

          <button
            disabled={busy}
            className="bg-amber-800 text-white rounded-lg p-3 w-full mt-3 disabled:opacity-50"
            onClick={placeOrder}
          >
            {busy ? 'Please wait...' : 'Proceed to checkout'}
          </button>

          <button
            className="w-full mt-2 text-stone-600"
            onClick={() => setCart([])}
          >
            Clear cart
          </button>

        </aside>

      )}

      {/* LOGIN */}
      {loginOpen && (

        <div className="fixed inset-0 bg-black/60 z-40 grid place-items-center p-4">

          <div className="bg-white p-6 rounded-xl w-full max-w-sm">

            <button
              className="float-right"
              onClick={() => setLoginOpen(false)}
            >
              <X />
            </button>

            <h2 className="text-2xl font-serif">
              Login
            </h2>

            <p className="text-sm text-stone-500 mt-1">
              Sign in to your MPR Jewellery account.
            </p>

            <input
              className="border p-3 rounded-lg w-full mt-4"
              placeholder="Email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />

            <input
              className="border p-3 rounded-lg w-full mt-3"
              placeholder="Password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
            />

            <button
              disabled={busy}
              className="bg-amber-800 text-white rounded-lg p-3 w-full mt-4 disabled:opacity-50"
              onClick={signIn}
            >
              {busy ? 'Signing in...' : 'Sign in'}
            </button>

          </div>

        </div>

      )}

      {/* NOTIFICATION */}
      {message && (

        <div className="fixed top-24 right-4 bg-stone-900 text-white rounded-lg p-4 z-50 max-w-sm shadow-lg">

          <div className="flex items-center gap-3">

            <span>{message}</span>

            <button onClick={() => setMessage('')}>
              <X size={18} />
            </button>

          </div>

        </div>

      )}

    </div>
  );
}
