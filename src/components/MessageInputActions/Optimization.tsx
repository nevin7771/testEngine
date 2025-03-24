import { BookOpen, ChevronDown, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Popover,
  PopoverButton,
  PopoverPanel,
  Transition,
} from '@headlessui/react';
import { Fragment } from 'react';

const ResponseModes = [
  {
    key: 'formal',
    title: 'Formal',
    description: 'Concise responses limited to 200 words',
    icon: <MessageSquare size={20} className="text-[#4CAF50]" />,
  },
  {
    key: 'explanatory',
    title: 'Explanatory',
    description: 'Detailed responses between 700-1500 words',
    icon: <BookOpen size={20} className="text-[#2196F3]" />,
  },
];

const Optimization = ({
  responseMode,
  setResponseMode,
}: {
  responseMode: string;
  setResponseMode: (mode: string) => void;
}) => {
  return (
    <Popover className="relative w-full max-w-[15rem] md:max-w-md lg:max-w-lg">
      <PopoverButton
        type="button"
        className="p-2 text-black/50 dark:text-white/50 rounded-xl hover:bg-light-secondary dark:hover:bg-dark-secondary active:scale-95 transition duration-200 hover:text-black dark:hover:text-white"
      >
        <div className="flex flex-row items-center space-x-1">
          {
            ResponseModes.find((mode) => mode.key === responseMode)
              ?.icon
          }
          <p className="text-xs font-medium">
            {
              ResponseModes.find((mode) => mode.key === responseMode)
                ?.title
            }
          </p>
          <ChevronDown size={20} />
        </div>
      </PopoverButton>
      <Transition
        as={Fragment}
        enter="transition ease-out duration-150"
        enterFrom="opacity-0 translate-y-1"
        enterTo="opacity-100 translate-y-0"
        leave="transition ease-in duration-150"
        leaveFrom="opacity-100 translate-y-0"
        leaveTo="opacity-0 translate-y-1"
      >
        <PopoverPanel className="absolute z-10 w-64 md:w-[250px] right-0">
          <div className="flex flex-col gap-2 bg-light-primary dark:bg-dark-primary border rounded-lg border-light-200 dark:border-dark-200 w-full p-4 max-h-[200px] md:max-h-none overflow-y-auto">
            {ResponseModes.map((mode, i) => (
              <PopoverButton
                onClick={() => setResponseMode(mode.key)}
                key={i}
                className={cn(
                  'p-2 rounded-lg flex flex-col items-start justify-start text-start space-y-1 duration-200 cursor-pointer transition',
                  responseMode === mode.key
                    ? 'bg-light-secondary dark:bg-dark-secondary'
                    : 'hover:bg-light-secondary dark:hover:bg-dark-secondary',
                )}
              >
                <div className="flex flex-row items-center space-x-1 text-black dark:text-white">
                  {mode.icon}
                  <p className="text-sm font-medium">{mode.title}</p>
                </div>
                <p className="text-black/70 dark:text-white/70 text-xs">
                  {mode.description}
                </p>
              </PopoverButton>
            ))}
          </div>
        </PopoverPanel>
      </Transition>
    </Popover>
  );
};

export default Optimization;