import { useEffect, useState } from 'react';
import type { FC, FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Check, Copy, Plus, Users } from 'lucide-react';
import { ListContainer } from '../components/ListContainer';
import { useSnackbarStore } from '../store/useSnackbarStore';
import { api } from '../utils/api';
import type { CeremonySummary, SignerSummary } from '../types';

/**
 * 서명자(Signer) 관리(`/org/ceremonies/:organizationId/:ceremonyId/signers`). 목록과 등록 폼을
 * 한 화면에 둔다(UserOrganizationDetail의 멤버 추가 폼과 같은 패턴) — 필드 수가 적어 별도
 * 등록 화면을 만들 필요가 없다. accessKey는 서명자 포털 접속에 쓰인다(4라운드) — 지금은 복사
 * 버튼만 미리 달아둔다.
 */
export const UserSignerList: FC = () => {
  const { organizationId, ceremonyId } = useParams<{ organizationId: string; ceremonyId: string }>();
  const showSnackbar = useSnackbarStore((state) => state.showSnackbar);

  const [signers, setSigners] = useState<SignerSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCompleted, setIsCompleted] = useState(false);

  const [isAddFormOpen, setIsAddFormOpen] = useState(false);
  const [name, setName] = useState('');
  const [position, setPosition] = useState('');
  const [affiliation, setAffiliation] = useState('');
  const [roleCode, setRoleCode] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const [copiedId, setCopiedId] = useState<number | null>(null);

  const detailPath = `/org/ceremonies/${organizationId}/${ceremonyId}`;

  const fetchSigners = async () => {
    const response = await api.get(`/organizations/${organizationId}/ceremonies/${ceremonyId}/signers`);
    return response.data as SignerSummary[];
  };

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const data = await fetchSigners();
        if (!cancelled) {
          setSigners(data);
        }
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : '서명자 목록을 불러오지 못했습니다.';
          showSnackbar(message, 'error');
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId, ceremonyId]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const response = await api.get(`/organizations/${organizationId}/ceremonies/${ceremonyId}`);
        if (!cancelled) {
          setIsCompleted((response.data as CeremonySummary).status === 'COMPLETED');
        }
      } catch {
        // 완료 여부를 못 가져와도 목록 자체를 막지는 않는다 — 최종 방어선은 백엔드다.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [organizationId, ceremonyId]);

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      showSnackbar('서명자 이름을 입력해주세요.', 'error');
      return;
    }

    setIsAdding(true);
    try {
      await api.post(`/organizations/${organizationId}/ceremonies/${ceremonyId}/signers`, {
        name: name.trim(),
        position: position.trim() || null,
        affiliation: affiliation.trim() || null,
        roleCode: roleCode.trim() || null,
      });
      showSnackbar('서명자를 등록했습니다.', 'success');
      setName('');
      setPosition('');
      setAffiliation('');
      setRoleCode('');
      setIsAddFormOpen(false);
      setSigners(await fetchSigners());
    } catch (err) {
      const message = err instanceof Error ? err.message : '서명자 등록에 실패했습니다.';
      showSnackbar(message, 'error');
    } finally {
      setIsAdding(false);
    }
  };

  const handleCopyAccessKey = async (signer: SignerSummary) => {
    try {
      await navigator.clipboard.writeText(signer.accessKey);
      setCopiedId(signer.id);
      setTimeout(() => setCopiedId((prev) => (prev === signer.id ? null : prev)), 1500);
    } catch {
      showSnackbar('접속키 복사에 실패했습니다.', 'error');
    }
  };

  return (
    <div>
      <Link to={detailPath} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-950 mb-4">
        <ArrowLeft size={16} />
        행사 상세로
      </Link>

      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-950 flex items-center gap-2">
            <Users size={20} className="text-gray-400" />
            서명자 관리
          </h1>
          <p className="mt-1 text-sm text-gray-500">이 행사의 하위 행사(TEST/MAIN)가 명단을 공유합니다.</p>
          {isCompleted && <p className="mt-1 text-xs text-gray-400">완료된 행사입니다. 서명자 등록은 더 이상 할 수 없습니다.</p>}
        </div>
        {!isAddFormOpen && !isCompleted && (
          <button
            onClick={() => setIsAddFormOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-md bg-gray-950 text-white text-sm font-medium hover:bg-gray-800 transition-colors"
          >
            <Plus size={16} />
            서명자 등록
          </button>
        )}
      </div>

      {isAddFormOpen && (
        <form
          onSubmit={handleAdd}
          className="mb-4 bg-white border border-gray-200 rounded-lg p-4 flex flex-wrap items-end gap-2"
        >
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">이름</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isAdding}
              className="px-3 py-1.5 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-gray-950/10 focus:border-gray-400 outline-none disabled:bg-gray-100"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">직책</label>
            <input
              type="text"
              value={position}
              onChange={(e) => setPosition(e.target.value)}
              disabled={isAdding}
              className="px-3 py-1.5 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-gray-950/10 focus:border-gray-400 outline-none disabled:bg-gray-100"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">소속</label>
            <input
              type="text"
              value={affiliation}
              onChange={(e) => setAffiliation(e.target.value)}
              disabled={isAdding}
              className="px-3 py-1.5 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-gray-950/10 focus:border-gray-400 outline-none disabled:bg-gray-100"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">역할 코드</label>
            <input
              type="text"
              value={roleCode}
              onChange={(e) => setRoleCode(e.target.value)}
              disabled={isAdding}
              placeholder="선택 입력"
              className="px-3 py-1.5 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-gray-950/10 focus:border-gray-400 outline-none disabled:bg-gray-100"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={isAdding}
              className="px-3 py-1.5 rounded-md bg-gray-950 text-white text-xs font-medium hover:bg-gray-800 disabled:opacity-50"
            >
              {isAdding ? '등록 중...' : '등록'}
            </button>
            <button
              type="button"
              onClick={() => setIsAddFormOpen(false)}
              disabled={isAdding}
              className="px-3 py-1.5 rounded-md border border-gray-200 text-gray-600 text-xs font-medium hover:border-gray-400 disabled:opacity-50"
            >
              취소
            </button>
          </div>
        </form>
      )}

      <ListContainer isLoading={isLoading} isEmpty={signers.length === 0} emptyMessage="아직 등록된 서명자가 없습니다.">
        <table className="w-full text-sm">
          <thead className="text-gray-500 text-xs">
            <tr>
              <th className="text-left font-medium px-4 py-2">이름</th>
              <th className="text-left font-medium px-4 py-2">직책</th>
              <th className="text-left font-medium px-4 py-2">소속</th>
              <th className="text-right font-medium px-4 py-2">접속키</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {signers.map((signer) => (
              <tr key={signer.id}>
                <td className="px-4 py-2 text-gray-950">{signer.name}</td>
                <td className="px-4 py-2 text-gray-500">{signer.position ?? '-'}</td>
                <td className="px-4 py-2 text-gray-500">{signer.affiliation ?? '-'}</td>
                <td className="px-4 py-2 text-right">
                  <button
                    onClick={() => handleCopyAccessKey(signer)}
                    className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-950"
                  >
                    {copiedId === signer.id ? (
                      <>
                        <Check size={12} />
                        복사됨
                      </>
                    ) : (
                      <>
                        <Copy size={12} />
                        복사
                      </>
                    )}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </ListContainer>
    </div>
  );
};
